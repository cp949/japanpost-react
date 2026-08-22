/**
 * acorn AST에서 전역으로 해석되는 식별자를 가려낸다.
 *
 * acorn은 scope 정보를 주지 않는다. Identifier 노드에 바인딩 정보가 없고
 * acorn-walk도 순회만 제공한다. 지역 선언이 전역 이름을 가리는 경우를
 * 판정하려면 scope 체인을 직접 세워야 한다.
 *
 * 이 판정이 게이트 2의 Tier 1을 "확정"으로 만든다 —
 * 수신자가 전역임을 증명하지 못하면 오탐 없는 판정이라고 할 수 없다.
 */

/** 자기 스코프를 여는 함수 노드다. */
const FUNCTION_TYPES = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/** 블록 스코프를 여는 노드다. */
const BLOCK_TYPES = new Set([
  "BlockStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "SwitchStatement",
  "StaticBlock",
  "ClassBody",
]);

/** 스코프 하나다. isVarScope는 var hoisting이 멈추는 경계다. */
function createScope(parent, isVarScope) {
  return { parent, isVarScope, names: new Set() };
}

/** 이름을 스코프에 선언한다. var는 가장 가까운 함수 스코프까지 올라간다. */
function declare(scope, name, hoistToFunction) {
  let target = scope;

  if (hoistToFunction) {
    while (!target.isVarScope && target.parent !== null) {
      target = target.parent;
    }
  }

  target.names.add(name);
}

/** 스코프 체인을 거슬러 이름이 선언됐는지 본다. */
function isBound(scope, name) {
  for (let current = scope; current !== null; current = current.parent) {
    if (current.names.has(name)) {
      return true;
    }
  }

  return false;
}

/** 노드의 자식 노드를 훑는다. type 필드를 가진 객체만 노드로 본다. */
function childNodes(node) {
  const children = [];

  for (const key of Object.keys(node)) {
    // start/end/loc은 위치 정보다. 순회 대상이 아니다.
    if (key === "start" || key === "end" || key === "loc" || key === "range") {
      continue;
    }

    const value = node[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item !== null &&
          typeof item === "object" &&
          typeof item.type === "string"
        ) {
          children.push(item);
        }
      }
      continue;
    }

    if (
      value !== null &&
      typeof value === "object" &&
      typeof value.type === "string"
    ) {
      children.push(value);
    }
  }

  return children;
}

/**
 * 바인딩 패턴에서 선언되는 이름을 모은다.
 * 구조분해, 기본값, rest를 모두 훑는다.
 */
function collectPatternNames(pattern, into) {
  if (pattern === null || typeof pattern !== "object") {
    return;
  }

  switch (pattern.type) {
    case "Identifier":
      into.push(pattern.name);
      return;
    case "ObjectPattern":
      for (const property of pattern.properties) {
        if (property.type === "RestElement") {
          collectPatternNames(property.argument, into);
          continue;
        }

        collectPatternNames(property.value, into);
      }
      return;
    case "ArrayPattern":
      for (const element of pattern.elements) {
        collectPatternNames(element, into);
      }
      return;
    case "AssignmentPattern":
      collectPatternNames(pattern.left, into);
      return;
    case "RestElement":
      collectPatternNames(pattern.argument, into);
      return;
    default:
  }
}

/** 직속 export wrapper가 감싼 선언을 돌려준다. */
function unwrapExportDeclaration(node) {
  if (
    (node.type === "ExportNamedDeclaration" ||
      node.type === "ExportDefaultDeclaration") &&
    node.declaration !== null
  ) {
    return node.declaration;
  }

  return node;
}

/**
 * 스코프가 열릴 때 그 안의 바인딩을 미리 등록한다.
 *
 * 함수 선언·var·import는 참조보다 뒤에 나와도 이미 바인딩돼 있다.
 * let·const·class도 초기화 전에는 TDZ지만 지역 바인딩 자체는 존재한다.
 * 미리 등록하지 않으면 선언 앞의 참조를 전역으로 잘못 판정한다.
 */
function hoistDeclarations(body, scope) {
  // 직속 선언은 현재 body의 scope에만 선등록한다. 중첩 블록 선언은
  // 그 블록을 방문할 때 별도 scope에 등록한다.
  for (const node of body) {
    const declaration = unwrapExportDeclaration(node);

    if (declaration.type === "FunctionDeclaration" && declaration.id !== null) {
      declare(scope, declaration.id.name, false);
      continue;
    }

    if (
      declaration.type === "VariableDeclaration" &&
      declaration.kind !== "var"
    ) {
      for (const declarator of declaration.declarations) {
        const names = [];

        collectPatternNames(declarator.id, names);

        for (const name of names) {
          declare(scope, name, false);
        }
      }

      continue;
    }

    if (declaration.type === "ClassDeclaration" && declaration.id !== null) {
      declare(scope, declaration.id.name, false);
      continue;
    }

    if (node.type === "ImportDeclaration") {
      for (const specifier of node.specifiers) {
        declare(scope, specifier.local.name, false);
      }
    }
  }

  const pending = [...body];

  while (pending.length > 0) {
    const node = pending.pop();

    if (
      node === null ||
      typeof node !== "object" ||
      typeof node.type !== "string"
    ) {
      continue;
    }

    // 중첩 함수와 static block 안의 var는 각각 독립된 hoisting 경계 소속이다.
    // 바깥 scope의 prepass에서 안쪽 선언을 끌어올리지 않는다.
    if (FUNCTION_TYPES.has(node.type) || node.type === "StaticBlock") {
      continue;
    }

    if (node.type === "VariableDeclaration" && node.kind === "var") {
      for (const declarator of node.declarations) {
        const names = [];

        collectPatternNames(declarator.id, names);

        for (const name of names) {
          declare(scope, name, true);
        }
      }
    }

    pending.push(...childNodes(node));
  }
}

/**
 * 이 노드가 값 참조가 아니라 이름 자리인지 본다.
 *
 * 멤버 표현식의 non-computed 프로퍼티, 객체 리터럴의 non-computed 키,
 * 라벨은 식별자 노드지만 전역을 참조하지 않는다.
 */
function isNamePosition(parent, node) {
  if (parent === null) {
    return false;
  }

  if (parent.type === "MemberExpression") {
    return parent.property === node && !parent.computed;
  }

  if (parent.type === "Property") {
    // 축약 표기 `{ structuredClone }`에서 acorn은 key와 value를 위치만 같은
    // 별개 Identifier 객체로 만든다(`key === value`는 false다).
    // key만 이름 자리로 걸러내면 value 쪽이 값 참조로 남아 정확히 한 번 세어진다.
    return parent.key === node && !parent.computed;
  }

  if (
    parent.type === "PropertyDefinition" ||
    parent.type === "MethodDefinition"
  ) {
    return parent.key === node && !parent.computed;
  }

  if (
    parent.type === "LabeledStatement" ||
    parent.type === "BreakStatement" ||
    parent.type === "ContinueStatement"
  ) {
    return parent.label === node;
  }

  if (parent.type === "ExportSpecifier") {
    // acorn은 파스 타임에 export specifier의 local이 실제 바인딩을
    // 가리키도록 강제한다(예: 선언되지 않은 이름을 export하면 파스 자체가
    // 던진다). 그래서 이 자리는 항상 이름 자리로 봐도 안전하다 —
    // isBound로 다시 확인해도 결과가 같다.
    // ImportSpecifier는 여기 없다 — acorn이 local을 검증하지 않고,
    // 위 ImportDeclaration 케이스가 이미 local을 선언하고 return해
    // 이 분기까지 도달하지도 않는다(도달 불가 코드였다).
    return true;
  }

  if (parent.type === "MetaProperty") {
    // new.target, import.meta의 meta·property는 둘 다 고정 키워드 자리다.
    // 스코프에 없는 이름이라고 전역으로 잘못 세면 안 된다.
    return true;
  }

  if (parent.type === "ExportAllDeclaration") {
    // `export * as name from "mod"`의 exported는 스코프 참조가 아니라
    // 재수출 별칭이다. `export * from "mod"`는 exported가 null이라
    // 애초에 이 자리에 노드가 없다 — 그래서 unconditional true가 아니라
    // 노드 동일성 비교다.
    return parent.exported === node;
  }

  return false;
}

/**
 * AST를 훑어 전역으로 해석되는 Identifier 노드를 모은다.
 *
 * @param {object} ast acorn이 만든 Program 노드
 * @returns {Set<object>} 전역 참조인 Identifier 노드 집합
 */
export function collectGlobalReferences(ast) {
  const globalRefs = new Set();
  const moduleScope = createScope(null, true);

  hoistDeclarations(ast.body, moduleScope);

  /** 노드 하나를 방문한다. scope는 이 노드가 속한 스코프다. */
  function visit(node, parent, scope) {
    if (
      node === null ||
      typeof node !== "object" ||
      typeof node.type !== "string"
    ) {
      return;
    }

    // 선언은 자식을 방문하기 전에 등록해야 뒤따르는 참조가 가려진다.
    switch (node.type) {
      case "ImportDeclaration":
        for (const specifier of node.specifiers) {
          declare(scope, specifier.local.name, false);
        }
        return;
      case "VariableDeclaration": {
        for (const declarator of node.declarations) {
          const names = [];

          collectPatternNames(declarator.id, names);

          for (const name of names) {
            // var는 hoistDeclarations가 이미 등록했다. let/const만 여기서 등록한다.
            declare(scope, name, node.kind === "var");
          }

          if (declarator.init !== null && declarator.init !== undefined) {
            visit(declarator.init, declarator, scope);
          }

          // 구조분해 기본값 안의 참조는 값 자리다.
          visitPatternDefaults(declarator.id, scope);
        }
        return;
      }
      case "ClassDeclaration":
        if (node.id !== null && node.id !== undefined) {
          declare(scope, node.id.name, false);
        }
        break;
      case "Identifier":
        if (isNamePosition(parent, node)) {
          return;
        }

        if (!isBound(scope, node.name)) {
          globalRefs.add(node);
        }
        return;
      default:
    }

    if (FUNCTION_TYPES.has(node.type)) {
      const functionScope = createScope(scope, true);

      // 함수 표현식의 이름은 자기 스코프 안에서만 보인다.
      if (
        node.type === "FunctionExpression" &&
        node.id !== null &&
        node.id !== undefined
      ) {
        declare(functionScope, node.id.name, false);
      }

      for (const param of node.params) {
        const names = [];

        collectPatternNames(param, names);

        for (const name of names) {
          declare(functionScope, name, false);
        }
      }

      for (const param of node.params) {
        visitPatternDefaults(param, functionScope);
      }

      if (node.body.type === "BlockStatement") {
        hoistDeclarations(node.body.body, functionScope);

        for (const statement of node.body.body) {
          visit(statement, node.body, functionScope);
        }

        return;
      }

      visit(node.body, node, functionScope);
      return;
    }

    if (node.type === "ClassExpression") {
      // 클래스 표현식의 이름은 자기 스코프 안에서만 보인다 — FunctionExpression과
      // 같은 자기 참조 규칙이다. ClassDeclaration은 이미 위 switch에서 바깥
      // scope에 선언되므로 여기 오지 않는다. 이 분기가 없으면 `class WeakRef {}`의
      // id가 이름 자리로도 자기 스코프로도 처리되지 않아 일반 재귀를 타고
      // Identifier 케이스로 떨어져 전역 참조로 오판된다(Tier 1 오탐).
      const classScope = createScope(scope, false);

      if (node.id !== null && node.id !== undefined) {
        declare(classScope, node.id.name, false);
      }

      for (const child of childNodes(node)) {
        visit(child, node, classScope);
      }

      return;
    }

    if (node.type === "CatchClause") {
      const catchScope = createScope(scope, false);

      if (node.param !== null && node.param !== undefined) {
        const names = [];

        collectPatternNames(node.param, names);

        for (const name of names) {
          declare(catchScope, name, false);
        }
      }

      hoistDeclarations(node.body.body, catchScope);

      for (const statement of node.body.body) {
        visit(statement, node.body, catchScope);
      }

      return;
    }

    if (BLOCK_TYPES.has(node.type)) {
      // static block의 var는 바깥 함수가 아니라 static block 자체에 hoist된다.
      const blockScope = createScope(scope, node.type === "StaticBlock");

      if (node.type === "BlockStatement" || node.type === "StaticBlock") {
        hoistDeclarations(node.body, blockScope);
      } else if (node.type === "SwitchStatement") {
        hoistDeclarations(
          node.cases.flatMap((switchCase) => switchCase.consequent),
          blockScope,
        );
      }

      for (const child of childNodes(node)) {
        visit(child, node, blockScope);
      }

      return;
    }

    for (const child of childNodes(node)) {
      visit(child, node, scope);
    }
  }

  /** 바인딩 패턴 안의 기본값 표현식만 방문한다. 이름 자리는 건너뛴다. */
  function visitPatternDefaults(pattern, scope) {
    if (pattern === null || typeof pattern !== "object") {
      return;
    }

    switch (pattern.type) {
      case "AssignmentPattern":
        visit(pattern.right, pattern, scope);
        visitPatternDefaults(pattern.left, scope);
        return;
      case "ObjectPattern":
        for (const property of pattern.properties) {
          if (property.type === "RestElement") {
            visitPatternDefaults(property.argument, scope);
            continue;
          }

          if (property.computed) {
            visit(property.key, property, scope);
          }

          visitPatternDefaults(property.value, scope);
        }
        return;
      case "ArrayPattern":
        for (const element of pattern.elements) {
          visitPatternDefaults(element, scope);
        }
        return;
      case "RestElement":
        visitPatternDefaults(pattern.argument, scope);
        return;
      default:
    }
  }

  for (const statement of ast.body) {
    visit(statement, ast, moduleScope);
  }

  return globalRefs;
}
