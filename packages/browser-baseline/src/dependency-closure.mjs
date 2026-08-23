/**
 * 최종 dist의 외부 module specifier를 package.json과 대조한다.
 *
 * peer dependency와 패키지 자신만 외부 import로 남을 수 있다. 그 밖의
 * runtime 코드는 번들 안에 들어와 문법·API 게이트의 실제 검사 대상이 돼야 한다.
 */
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";

import { parse } from "acorn";

import { collectGlobalReferences } from "./compat-scope.mjs";

const NODE_PREFIX_BUILTIN_ROOTS = new Set(
  builtinModules.map(
    (specifier) => specifier.replace(/^node:/, "").split("/")[0],
  ),
);
const BARE_BUILTIN_ROOTS = new Set(
  builtinModules
    .filter((specifier) => !specifier.startsWith("node:"))
    .map((specifier) => specifier.split("/")[0]),
);
const IGNORED_PREFIXES = ["./", "../", "/", "#"];
const WINDOWS_RELATIVE_PREFIXES = [".\\", "..\\"];
const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

/** package.json의 dependency map 하나를 검증해 이름 집합으로 바꾼다. */
function dependencyNames(manifest, field, manifestPath) {
  const value = manifest[field];

  if (value === undefined) {
    return new Set();
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${manifestPath}의 ${field}는 배열이 아닌 객체여야 한다.`);
  }

  return new Set(Object.keys(value));
}

/** 정적 specifier를 package root로 줄인다. 잘못된 scoped 이름은 null이다. */
function packageRootOf(specifier) {
  if (!specifier.startsWith("@")) {
    return specifier.split("/")[0] || null;
  }

  const [scope, name] = specifier.split("/");

  if (scope.length <= 1 || !name) {
    return null;
  }

  return `${scope}/${name}`;
}

/** node: 및 bare/subpath 표기가 Node 내장 module을 가리키는지 본다. */
function isNodeBuiltin(specifier) {
  const hasNodePrefix = specifier.startsWith("node:");
  const bareSpecifier = hasNodePrefix
    ? specifier.slice("node:".length)
    : specifier;
  const root = bareSpecifier.split("/")[0];

  return (hasNodePrefix ? NODE_PREFIX_BUILTIN_ROOTS : BARE_BUILTIN_ROOTS).has(
    root,
  );
}

/** AST 노드의 자식 노드를 일반 순회한다. */
function walk(node, visit) {
  if (
    node === null ||
    typeof node !== "object" ||
    typeof node.type !== "string"
  ) {
    return;
  }

  visit(node);

  for (const [key, value] of Object.entries(node)) {
    if (key === "start" || key === "end" || key === "loc" || key === "range") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, visit);
      }
      continue;
    }

    walk(value, visit);
  }
}

/** 문자열 literal과 표현식 없는 template literal만 정적으로 읽는다. */
function staticSpecifier(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }

  if (
    node?.type === "TemplateLiteral" &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
  ) {
    return node.quasis[0].value.cooked ?? node.quasis[0].value.raw;
  }

  return null;
}

/** finding 정렬에 쓰는 null 안전 code-point 문자열 비교다. */
function compareText(left, right) {
  const leftCharacters = Array.from(left ?? "");
  const rightCharacters = Array.from(right ?? "");

  for (
    let index = 0;
    index < leftCharacters.length && index < rightCharacters.length;
    index += 1
  ) {
    const difference =
      leftCharacters[index].codePointAt(0) -
      rightCharacters[index].codePointAt(0);

    if (difference !== 0) {
      return difference;
    }
  }

  return leftCharacters.length - rightCharacters.length;
}

/**
 * packageDir의 manifest 계약으로 dependency closure scanner를 만든다.
 * manifest는 생성 시 한 번만 읽고, 파일별 scan은 같은 판정 집합을 재사용한다.
 */
export function createDependencyClosureScanner(packageDir) {
  const manifestPath = path.join(packageDir, "package.json");
  let manifest;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`${manifestPath}을 읽을 수 없다: ${error.message}`);
  }

  if (typeof manifest?.name !== "string" || manifest.name.trim() === "") {
    throw new Error(
      `${manifestPath}의 name은 비어 있지 않은 문자열이어야 한다.`,
    );
  }

  const peers = dependencyNames(manifest, "peerDependencies", manifestPath);
  const dependencies = dependencyNames(manifest, "dependencies", manifestPath);
  const optionalDependencies = dependencyNames(
    manifest,
    "optionalDependencies",
    manifestPath,
  );

  return {
    /** source 하나의 외부 module 참조를 판정한다. */
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

      const globalReferences = collectGlobalReferences(ast);
      const lines = source.split(/\r\n|[\n\r\u2028\u2029]/);
      const findings = [];

      function report(node, specifier, packageRoot, issue) {
        const line = node.loc.start.line;

        findings.push({
          kind: "dependency",
          file: fileName,
          line,
          specifier,
          packageRoot,
          issue,
          text: (lines[line - 1] ?? "").trim(),
        });
      }

      /** 정적 specifier 하나를 무시·허용·위반 중 하나로 분류한다. */
      function inspect(node, specifierNode, argumentCount = 1) {
        const specifier =
          argumentCount === 1 ? staticSpecifier(specifierNode) : null;

        if (specifier === null) {
          report(node, null, null, "computed-specifier");
          return;
        }

        if (
          IGNORED_PREFIXES.some((prefix) => specifier.startsWith(prefix)) ||
          WINDOWS_RELATIVE_PREFIXES.some((prefix) =>
            specifier.startsWith(prefix),
          ) ||
          path.win32.isAbsolute(specifier)
        ) {
          return;
        }

        if (URL_SCHEME.test(specifier) && !specifier.startsWith("node:")) {
          return;
        }

        const packageRoot = packageRootOf(specifier);

        // Node 내장은 peer나 self와 이름이 겹쳐도 브라우저 dist에서 허용하지 않는다.
        if (isNodeBuiltin(specifier)) {
          report(node, specifier, packageRoot, "node-builtin");
          return;
        }

        if (
          packageRoot !== null &&
          (packageRoot === manifest.name || peers.has(packageRoot))
        ) {
          return;
        }

        if (packageRoot !== null && optionalDependencies.has(packageRoot)) {
          report(node, specifier, packageRoot, "optional-dependency-leak");
          return;
        }

        if (packageRoot !== null && dependencies.has(packageRoot)) {
          report(node, specifier, packageRoot, "dependency-leak");
          return;
        }

        report(node, specifier, packageRoot, "undeclared-runtime");
      }

      walk(ast, (node) => {
        if (node.type === "ImportDeclaration") {
          inspect(node, node.source);
          return;
        }

        if (
          (node.type === "ExportNamedDeclaration" ||
            node.type === "ExportAllDeclaration") &&
          node.source !== null
        ) {
          inspect(node, node.source);
          return;
        }

        if (node.type === "ImportExpression") {
          inspect(node, node.source);
          return;
        }

        if (
          node.type === "CallExpression" &&
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          globalReferences.has(node.callee)
        ) {
          inspect(node, node.arguments[0], node.arguments.length);
        }
      });

      findings.sort(
        (left, right) =>
          left.line - right.line ||
          compareText(left.issue, right.issue) ||
          compareText(left.specifier, right.specifier),
      );

      return findings;
    },
  };
}
