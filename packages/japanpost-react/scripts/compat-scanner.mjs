/**
 * dist 산출물이 브라우저 지원 계약의 런타임 API 하한을 지키는지 검사한다.
 *
 * 문법 검사는 syntax-gate.mjs가 담당한다.
 * 이 module은 esbuild가 다운레벨할 수 없는 런타임 API만 다룬다.
 *
 * 검사 대상은 손으로 고른 목록이 아니라 compat-bcd.mjs가 BCD에서 파생한 색인이다.
 * 계약의 Chrome 하한을 올리면 색인이 저절로 줄어든다 — 목록 편집이 필요 없다.
 *
 * 판정은 세 단계다.
 *
 *   Tier 1(확정): 전역 식별자와 전역의 멤버. compat-scope.mjs의 scope 분석이
 *     수신자가 전역임을 증명하므로 오탐이 없다.
 *   Tier 2(모호): 수신자 타입을 정적으로 모르는 프로토타입·인스턴스 멤버.
 *     BCD 파생 색인의 최소 Chrome 버전으로 판정하며 ALLOWED가 유일한 해소 수단이다.
 *   Tier 3(특수): 옵션·파라미터 서브피처. 전용 AST 매처가 고정 BCD 키를 쓴다.
 *
 * 세 부류 모두 빌드를 실패시킨다.
 */
import { parse } from "acorn";

import { buildCompatIndex } from "./compat-bcd.mjs";
import { collectGlobalReferences } from "./compat-scope.mjs";

/**
 * 오탐 예외 목록이다.
 * dist는 생성물이라 인라인 주석을 넣을 수 없으므로 여기서 관리한다.
 * file은 검사 대상의 상대 경로다(예: "dist/index.es.js"). "*"는 전체를 뜻한다.
 * reason은 필수다 — 왜 안전한지를 남기지 않은 예외는 시간이 지나면 근거를 잃는다.
 */
export const ALLOWED = [];

/**
 * 전역 객체 자신을 가리키는 이름이다.
 *
 * `globalThis.structuredClone(v)`처럼 접두를 붙여도 같은 전역을 부르는 것이다.
 * BCD에서 이 전역들은 api/_globals/*에 살아 `Window.structuredClone` 같은
 * static 키가 없으므로, statics만 조회하면 접두 형태를 통째로 놓친다.
 * 교체 전 정규식은 `\b` 덕분에 접두 형태도 잡았으므로 이걸 빠뜨리면 회귀다.
 */
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

/**
 * cause 옵션을 받는 Error 계열과 옵션 인자 위치다.
 * 전부 같은 버전(Chrome 93)에 옵션을 얻었다.
 */
const ERROR_CONSTRUCTORS = new Map([
  ["Error", 1],
  ["EvalError", 1],
  ["RangeError", 1],
  ["ReferenceError", 1],
  ["SyntaxError", 1],
  ["TypeError", 1],
  ["URIError", 1],
  ["AggregateError", 2],
]);

/** 노드가 지정한 이름의 non-computed 프로퍼티를 가진 객체 리터럴인지 본다. */
function hasObjectKey(node, keyName) {
  if (node === null || node === undefined || node.type !== "ObjectExpression") {
    return false;
  }

  return node.properties.some((property) => {
    if (property.type !== "Property") {
      // 스프레드만 있으면 내용을 알 수 없다. 판정하지 않는다.
      return false;
    }

    if (property.computed) {
      // computed 키는 문자열 리터럴일 때만 판정한다.
      return property.key.type === "Literal" && property.key.value === keyName;
    }

    if (property.key.type === "Identifier") {
      return property.key.name === keyName;
    }

    return property.key.type === "Literal" && property.key.value === keyName;
  });
}

/** 멤버 표현식에서 프로퍼티 이름을 뽑는다. 판정할 수 없으면 null이다. */
function memberName(node) {
  if (!node.computed) {
    return node.property.type === "Identifier" ? node.property.name : null;
  }

  // computed 멤버는 키가 문자열 리터럴일 때만 판정한다.
  if (
    node.property.type === "Literal" &&
    typeof node.property.value === "string"
  ) {
    return node.property.value;
  }

  return null;
}

/** AST를 훑으며 방문자를 부른다. 부모 노드를 함께 넘긴다. */
function walk(node, parent, visit) {
  if (
    node === null ||
    typeof node !== "object" ||
    typeof node.type !== "string"
  ) {
    return;
  }

  visit(node, parent);

  for (const key of Object.keys(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") {
      continue;
    }

    const value = node[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, node, visit);
      }
      continue;
    }

    walk(value, node, visit);
  }
}

/** Tier 3 판정이 내는 이름이다. 색인 키와 형식이 다르므로 따로 본다. */
const SPECIAL_NAMES = new Set([
  "addEventListener({ signal })",
  ...[...ERROR_CONSTRUCTORS.keys()].map((name) => `new ${name}({ cause })`),
]);

/**
 * name이 색인 어딘가에 실재하는 판정 대상을 가리키는지 본다.
 * validateAllowed가 개별 ALLOWED 항목을 검증할 때 쓴다.
 */
function isKnownName(name, index) {
  if (SPECIAL_NAMES.has(name) || index.globals.has(name)) {
    return true;
  }

  // Tier 2는 ".name()" 또는 ".name" 형식이다. 색인 키는 맨 이름이다.
  if (name.startsWith(".")) {
    const bare = name.slice(1).replace(/\(\)$/, "");

    return index.members.has(bare);
  }

  const dot = name.indexOf(".");

  if (dot <= 0) {
    return false;
  }

  const head = name.slice(0, dot);
  const rest = name.slice(dot + 1);

  // 두 단계 접두(globalThis.Object.hasOwn 등)는 접두를 벗기고 나머지를
  // 같은 규칙으로 다시 본다 — 나머지가 "structuredClone"이면 전역 자체,
  // "Object.hasOwn"이면 정적 멤버다.
  if (GLOBAL_OBJECTS.has(head)) {
    return isKnownName(rest, index);
  }

  // Tier 1 멤버는 "전역.멤버" 형식이다. 색인 키는 "인터페이스.멤버"이므로
  // 타입이 고정된 전역은 인터페이스 이름으로 바꿔 다시 본다.
  const owner = index.knownGlobalTypes.get(head) ?? head;

  return index.statics.has(name) || index.statics.has(`${owner}.${rest}`);
}

/**
 * allowed 목록을 검증한다. 잘못된 예외는 조용히 무시하지 않고 던진다.
 *
 * 낡은 예외가 남으면 그 이름의 API가 다시 위험해져도 계속 통과한다.
 * 색인에 없는 이름은 오타이거나 기준선 상향으로 대상에서 빠진 항목이다.
 */
function validateAllowed(allowed, index) {
  for (const entry of allowed) {
    if (typeof entry.reason !== "string" || entry.reason.trim() === "") {
      throw new Error(
        `ALLOWED 항목 ${JSON.stringify(entry.name)}에 reason이 없다. 왜 안전한지를 남겨야 한다.`,
      );
    }

    if (typeof entry.file !== "string" || entry.file.trim() === "") {
      throw new Error(
        `ALLOWED 항목 ${JSON.stringify(entry.name)}에 file이 없다. 어느 산출물의 예외인지 적어야 한다("*"는 전체).`,
      );
    }

    if (!isKnownName(entry.name, index)) {
      throw new Error(
        `ALLOWED 항목 ${JSON.stringify(entry.name)}이 색인에 없다. 낡은 예외이거나 오타다.`,
      );
    }
  }
}

/**
 * 계약의 Chrome 하한에 맞춰 스캐너를 만든다.
 *
 * @param {{ minChrome: number, allowed?: Array<{ file: string, name: string, reason: string }> }} options
 */
export function createScanner({ minChrome, allowed = ALLOWED }) {
  if (!Number.isInteger(minChrome)) {
    throw new Error(
      `minChrome은 정수여야 한다. 받은 값: ${JSON.stringify(minChrome)}`,
    );
  }

  const index = buildCompatIndex({ minChrome });

  validateAllowed(allowed, index);

  return {
    minChrome,
    indexSize: index.globals.size + index.statics.size + index.members.size,

    /**
     * source를 파싱해 계약을 넘는 런타임 API 사용을 모은다.
     *
     * 파싱에 실패하면 던진다. dist가 파싱되지 않으면 검사 불가이며,
     * 검사 불가는 통과가 아니다.
     */
    scan(source, fileName = "") {
      let ast;

      try {
        ast = parse(source, {
          ecmaVersion: "latest",
          sourceType: "module",
          locations: true,
        });
      } catch (error) {
        throw new Error(`${fileName}을 파싱할 수 없다: ${error.message}`);
      }

      const lines = source.split("\n");
      const globalRefs = collectGlobalReferences(ast);
      const violations = [];
      // Tier 1으로 판정한 멤버 노드다. Tier 2가 중복 보고하지 않도록 표시한다.
      const claimed = new Set();

      function report(node, name, chrome, tier) {
        const line = node.loc.start.line;

        violations.push({
          file: fileName,
          line,
          name,
          chrome,
          text: (lines[line - 1] ?? "").trim(),
          tier,
        });
      }

      function isAllowed(name) {
        return allowed.some(
          (entry) =>
            entry.name === name &&
            (entry.file === fileName || entry.file === "*"),
        );
      }

      /**
       * MemberExpression의 수신자 표현식을 해석한다.
       *
       * 단순 식별자(`Object.hasOwn`의 `Object`)에서 시작해 전역 객체 접두를
       * 재귀적으로 벗긴다. `globalThis`, `window`, `self`가 반복돼도 깊이와
       * 무관하게 실제 수신자 이름과 소스 접두를 함께 보존한다.
       *
       * @returns {{ name: string, reportName: string, claim: object[] } | null}
       *   name: 색인 조회에 쓸 식별자 이름(접두를 벗긴 형태).
       *   reportName: Violation.name에 쓸, 소스 표기를 보존한 이름.
       *   claim: 판정이 확정되면 함께 claimed 처리할 노드 목록.
       *   판정할 수 없으면(수신자가 전역임을 증명 못 하거나 구조를 모르면) null이다.
       */
      function describeReceiver(objectExpr) {
        if (objectExpr.type === "Identifier") {
          if (!globalRefs.has(objectExpr)) {
            return null;
          }

          return {
            name: objectExpr.name,
            reportName: objectExpr.name,
            claim: [objectExpr],
          };
        }

        if (objectExpr.type === "MemberExpression") {
          const inner = memberName(objectExpr);
          const outer = describeReceiver(objectExpr.object);

          if (
            inner === null ||
            outer === null ||
            !GLOBAL_OBJECTS.has(outer.name)
          ) {
            return null;
          }

          return {
            name: inner,
            reportName: `${outer.reportName}.${inner}`,
            claim: [objectExpr, ...outer.claim],
          };
        }

        return null;
      }

      // 1) Tier 1과 3 — 전역과 특수 패턴을 먼저 훑어 claimed를 채운다.
      //    parent는 이 단계에서 쓰지 않는다. Tier 2 순회만 필요로 한다.
      walk(ast, null, (node) => {
        // typeof 가드는 기능 탐지 관용구다.
        // 선언되지 않은 이름에 써도 던지지 않으므로 어느 Chrome에서도 안전하다.
        // 폴리필 분기의 조건식을 위반으로 보고하면 Tier 1의 "확정"이 거짓이 된다.
        if (node.type === "UnaryExpression" && node.operator === "typeof") {
          claimed.add(node.argument);

          if (node.argument.type === "MemberExpression") {
            claimed.add(node.argument.object);
          }

          return;
        }

        const errorOptionsIndex =
          node.type === "NewExpression" && node.callee.type === "Identifier"
            ? ERROR_CONSTRUCTORS.get(node.callee.name)
            : undefined;

        // Tier 3: new Error(m, { cause })와 new AggregateError([], m, { cause })
        if (
          node.type === "NewExpression" &&
          node.callee.type === "Identifier" &&
          errorOptionsIndex !== undefined &&
          globalRefs.has(node.callee) &&
          // 생성자 자체가 아직 지원되지 않으면 더 이른 Tier 1 위반을 우선한다.
          !index.globals.has(node.callee.name) &&
          hasObjectKey(node.arguments[errorOptionsIndex], "cause")
        ) {
          const entry = index.special.get("Error.cause");

          if (entry === undefined) {
            // buildCompatIndex가 이미 이 키를 검증했으므로 여기 닿는 경우는
            // SPECIAL_KEYS와 이 매처의 문자열 리터럴 이름이 어긋난 것뿐이다.
            // §7대로 조용히 넘기지 않고 던진다.
            throw new Error(
              '특수 판정 키 "Error.cause"가 색인에 없다. compat-bcd.mjs의 SPECIAL_KEYS와 이름이 어긋났다.',
            );
          }

          if (entry.chrome > minChrome) {
            const name = `new ${node.callee.name}({ cause })`;

            if (!isAllowed(name)) {
              report(node, name, entry.chrome, 3);
            }
          }

          claimed.add(node.callee);
          return;
        }

        // Tier 3: addEventListener(t, f, { signal })
        // 수신자는 검증하지 않는다. EventTarget 서브클래스와 번들러 별칭을
        // 전부 열거할 수 없어 요구하면 과소보고가 된다.
        // 수신자 없는 호출(worker 전역 등)도 같은 서브피처이므로 함께 본다.
        const listenerName =
          node.type === "CallExpression"
            ? node.callee.type === "MemberExpression"
              ? memberName(node.callee)
              : node.callee.type === "Identifier"
                ? node.callee.name
                : null
            : null;

        if (
          listenerName === "addEventListener" &&
          hasObjectKey(node.arguments[2], "signal")
        ) {
          const entry = index.special.get("addEventListener.signal");

          if (entry === undefined) {
            throw new Error(
              '특수 판정 키 "addEventListener.signal"이 색인에 없다. compat-bcd.mjs의 SPECIAL_KEYS와 이름이 어긋났다.',
            );
          }

          if (entry.chrome > minChrome) {
            const name = "addEventListener({ signal })";

            if (!isAllowed(name)) {
              report(node, name, entry.chrome, 3);
            }
          }

          claimed.add(node.callee);
          return;
        }

        // Tier 1: 전역의 멤버
        if (node.type === "MemberExpression") {
          // walk는 전위 순회다. typeof 가드가 먼저 방문돼 면제 처리한 노드를
          // 이 분기가 다시 보고하면 면제가 무효가 된다.
          if (claimed.has(node)) {
            return;
          }

          const receiver = describeReceiver(node.object);

          if (receiver === null) {
            return;
          }

          const property = memberName(node);

          if (property === null) {
            return;
          }

          // 전역 객체 접두는 전역 자체를 부르는 것과 같다.
          // 이 이름들은 statics가 아니라 globals에 있으므로 따로 조회한다.
          const prefixed = GLOBAL_OBJECTS.has(receiver.name)
            ? index.globals.get(property)
            : undefined;

          // 전역 자체가 위반이면 멤버 접근으로 다시 세지 않는다.
          const owner =
            index.knownGlobalTypes.get(receiver.name) ?? receiver.name;
          const entry = prefixed ?? index.statics.get(`${owner}.${property}`);

          if (entry === undefined) {
            return;
          }

          claimed.add(node);

          // 수신자 쪽 노드도 claimed 처리한다. 두 종류가 섞여 있고 성격이 다르다.
          //
          // 중간 MemberExpression(2단계 접두의 `globalThis.Temporal` 등)은 실제로
          // 쓰인다. globals와 statics 소유자 이름이 동시에 걸치는 경우가 셋 있어서다
          // (AggregateError, SuppressedError, Temporal). 이것이 빠지면
          // Temporal.Now.instant()가 "Temporal.Now"(이 분기)와 바깥 전역
          // "Temporal"(전역 식별자 루프) 둘로 이중 보고된다.
          //
          // 전역 객체 식별자(globalThis·window·self)는 방어용이다. 셋 다
          // index.globals에 없어 지금은 결과를 바꾸지 못한다. BCD가 이 이름들을
          // 버전 있는 전역으로 싣게 되면 그때 필요해진다.
          for (const claimedNode of receiver.claim) {
            claimed.add(claimedNode);
          }

          const name = `${receiver.reportName}.${property}`;

          if (!isAllowed(name)) {
            report(node, name, entry.chrome, 1);
          }
        }
      });

      // 2) Tier 1 — 전역 식별자 자체.
      for (const node of globalRefs) {
        if (claimed.has(node)) {
          continue;
        }

        const entry = index.globals.get(node.name);

        if (entry === undefined) {
          continue;
        }

        if (!isAllowed(node.name)) {
          report(node, node.name, entry.chrome, 1);
        }
      }

      // 3) Tier 2 — 수신자 미상 멤버.
      walk(ast, null, (node, parent) => {
        if (node.type !== "MemberExpression" || claimed.has(node)) {
          return;
        }

        const property = memberName(node);

        if (property === null) {
          return;
        }

        const entry = index.members.get(property);

        if (entry === undefined) {
          return;
        }

        const isCallee =
          parent !== null &&
          parent.type === "CallExpression" &&
          parent.callee === node;
        const name = isCallee ? `.${property}()` : `.${property}`;

        if (!isAllowed(name)) {
          report(node, name, entry.chrome, 2);
        }
      });

      // 이름 비교는 코드포인트 순이다. localeCompare는 ICU·로케일에 따라
      // 결과가 달라져 게이트 출력이 환경마다 흔들린다.
      violations.sort((left, right) => {
        if (left.line !== right.line) {
          return left.line - right.line;
        }

        if (left.name === right.name) {
          return 0;
        }

        return left.name < right.name ? -1 : 1;
      });

      return violations;
    },
  };
}
