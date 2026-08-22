import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const rootPackageJsonPath = path.join(repoRoot, "package.json");
const packagePackageJsonPath = path.join(
  repoRoot,
  "packages/japanpost-react/package.json",
);
const contributingPath = path.join(repoRoot, "CONTRIBUTING.md");
const tsupConfigPath = path.join(
  repoRoot,
  "packages/japanpost-react/tsup.config.ts",
);
const syntaxGatePath = path.join(
  repoRoot,
  "packages/japanpost-react/scripts/syntax-gate.mjs",
);
const compatScannerPaths = [
  "packages/japanpost-react/scripts/compat-bcd.mjs",
  "packages/japanpost-react/scripts/compat-scope.mjs",
  "packages/japanpost-react/scripts/compat-scanner.mjs",
].map((relativePath) => path.join(repoRoot, relativePath));

function readPackageJson(packageJsonPath: string): {
  scripts?: Record<string, string>;
  browserslist?: string[];
} {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
    browserslist?: string[];
  };
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

/** 기준선을 손으로 적은 리터럴 패턴이다. 예: "es2019", "chrome80" */
const BASELINE_LITERAL = /["'`](es20\d\d|chrome\d+)["'`]/;

/** 워크스페이스를 훑을 때 건너뛸 디렉터리다. */
const SKIPPED_DIRS = new Set(["node_modules", "dist", ".git", ".turbo"]);

/** repoRoot 아래의 package.json 경로를 모은다. */
function collectPackageJsonPaths(dir: string, into: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) {
        collectPackageJsonPaths(path.join(dir, entry.name), into);
      }

      continue;
    }

    if (entry.name === "package.json") {
      into.push(path.join(dir, entry.name));
    }
  }

  return into;
}

/**
 * 정규식 리터럴이 시작될 수 있는 직전 유의 문자다.
 * 이 위치가 아니면 "/"는 나눗셈 연산자로 본다.
 */
const REGEX_ALLOWED_BEFORE = new Set([
  "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";",
  "+", "-", "*", "%", "~", "^", "<", ">",
]);

/** 문자열 리터럴 하나의 길이를 잰다. 이스케이프를 건너뛴다. */
function scanString(source: string, start: number): number {
  const quote = source[start];
  let index = start + 1;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === quote) {
      return index - start + 1;
    }

    index += 1;
  }

  return index - start;
}

/** 정규식 리터럴 하나의 길이를 잰다. 이스케이프와 문자 클래스를 건너뛴다. */
function scanRegex(source: string, start: number): number {
  let index = start + 1;
  let inClass = false;

  while (index < source.length) {
    const char = source[index];

    if (char === "\\") {
      index += 2;
      continue;
    }

    if (char === "[") {
      inClass = true;
    } else if (char === "]") {
      inClass = false;
    } else if (char === "/" && !inClass) {
      return index - start + 1;
    } else if (char === "\n") {
      break;
    }

    index += 1;
  }

  return index - start;
}

/**
 * 주석을 지운 코드 영역만 돌려준다.
 *
 * 리터럴 금지 검사가 설명용 주석까지 잡으면 오탐이다.
 * 반대로 문자열이나 정규식 안의 "//"를 주석으로 오인하면 그 줄의 코드가 통째로
 * 사라져 진짜 리터럴을 놓치므로, 두 문맥은 건너뛰지 않고 그대로 남긴다.
 *
 * 판정이 모호하지 않은 이유: "//"와 "/*"는 유효한 정규식 시작이 될 수 없다.
 * 빈 정규식과 선행 수량자는 문법 오류이기 때문이다.
 * 따라서 이 둘은 문맥과 무관하게 항상 주석이고, 나머지 "/"만 정규식/나눗셈으로 가른다.
 */
function codeRegionOf(source: string): string {
  let out = "";
  let index = 0;
  let previous = "";

  /** length만큼 코드로 옮기고 직전 유의 문자를 갱신한다. */
  function emit(length: number) {
    const chunk = source.slice(index, index + length);
    const significant = chunk.trimEnd();

    out += chunk;
    index += length;

    if (significant.length > 0) {
      previous = significant[significant.length - 1];
    }
  }

  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") {
        index += 1;
      }

      continue;
    }

    if (char === "/" && next === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 2;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      emit(scanString(source, index));
      continue;
    }

    if (
      char === "/" &&
      (previous === "" || REGEX_ALLOWED_BEFORE.has(previous))
    ) {
      emit(scanRegex(source, index));
      continue;
    }

    emit(1);
  }

  return out;
}

describe("repository verification scripts", () => {
  it("exposes the standard repository verification path at the repository root", () => {
    const rootPackageJson = readPackageJson(rootPackageJsonPath);

    expect(rootPackageJson.scripts).toEqual(
      expect.objectContaining({
        test: "node ./scripts/test.mjs",
        "test:package": "pnpm --filter @cp949/japanpost-react test",
      }),
    );
    expect(rootPackageJson.scripts).not.toHaveProperty("verify:release");
  });

  it("makes the package release script reuse the root repository verification path", () => {
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    expect(packagePackageJson.scripts).toEqual(
      expect.objectContaining({
        release: expect.stringContaining(
          "pnpm lint && pnpm check-types && pnpm --dir ../.. test && pnpm build && pnpm publish --access public",
        ),
      }),
    );
  });

  it("브라우저 지원 기준선의 정본은 package.json#browserslist 하나다", () => {
    const tsupConfig = readText(tsupConfigPath);
    const syntaxGate = readText(syntaxGatePath);
    const packagePackageJson = readPackageJson(packagePackageJsonPath);

    // 정본. 이 값을 바꾸는 것이 계약을 바꾸는 유일한 방법이어야 한다.
    expect(packagePackageJson.browserslist).toEqual(["chrome >= 80"]);

    // 소비자는 파생만 한다. 리터럴이 다시 들어오면 정본이 둘이 된다.
    // 설명용 주석까지 잡지 않도록 코드 영역만 본다.
    expect(codeRegionOf(tsupConfig)).toContain("loadBaseline(");
    expect(codeRegionOf(tsupConfig)).not.toMatch(/target\s*=\s*["'`](es|chrome)/);
    expect(codeRegionOf(syntaxGate)).not.toContain("SYNTAX_TARGET");
    expect(codeRegionOf(syntaxGate)).not.toMatch(BASELINE_LITERAL);
  });

  it("AST 스캐너 모듈에 기준선 리터럴이 없다", () => {
    // 계약의 Chrome 하한은 loadBaseline이 파생해 minChrome 인자로 흐른다.
    // 모듈이 값을 손으로 적으면 정본이 둘이 된다.
    for (const filePath of compatScannerPaths) {
      expect(codeRegionOf(readText(filePath)), filePath).not.toMatch(
        BASELINE_LITERAL,
      );
    }
  });

  it("워크스페이스에서 browserslist를 선언하는 package.json은 정본 하나뿐이다", () => {
    const declaring = collectPackageJsonPaths(repoRoot)
      .filter((filePath) => readPackageJson(filePath).browserslist !== undefined)
      .map((filePath) => path.relative(repoRoot, filePath));

    // 정본이 둘이면 파생 경로가 잘못된 디렉터리를 잡아도 조용히 다른 기준선으로 빌드된다.
    expect(declaring).toEqual(["packages/japanpost-react/package.json"]);
  });

  it("tsup 설정은 번들 출력 위치에 기대지 않고 자기 경로를 구한다", () => {
    const tsupConfig = readText(tsupConfigPath);

    // bundle-require는 원본 소스마다 import.meta.url을 원본 경로로 주입한다.
    // import.meta.dirname은 주입 대상이 아니라서 번들 파일이 원본 옆에 쓰인다는
    // 현재 기본 출력 규칙에만 기댄다. 근거를 적은 주석 자체는 검사에서 빠져야 한다.
    const code = codeRegionOf(tsupConfig);

    expect(code).toContain("fileURLToPath(import.meta.url)");
    expect(code).not.toContain("import.meta.dirname");
  });

  it("CONTRIBUTING이 caniuse-lite 수동 갱신 경로를 안내한다", () => {
    const contributing = readText(contributingPath);

    // 이 저장소에는 Renovate/Dependabot이 없다. 갱신 경로가 문서에만 남는다.
    expect(contributing).toContain("npx update-browserslist-db@latest");
    expect(contributing).toContain("packages/japanpost-react/package.json");
  });

  it("documents which verification entrypoints are cross-platform and which direct script paths remain Bash-only in contributing docs", () => {
    const contributing = readText(contributingPath);

    expect(contributing).toContain(
      "`pnpm test`, `pnpm demo:full`, and `pnpm api:check`",
    );
    expect(contributing).toContain(
      "run through Node-based entrypoints and do not require Bash.",
    );
    expect(contributing).toContain(
      "Direct `scripts/*.sh` execution remains a Bash-only convenience path.",
    );
  });
});

describe("codeRegionOf", () => {
  it("주석 안의 기준선 리터럴은 코드 영역에 남기지 않는다", () => {
    const source = [
      '// 예: "chrome80" -> 80',
      "/* 이전 구현은 \"es2019\"를 상수로 썼다 */",
      "const target = readTarget();",
    ].join("\n");

    expect(codeRegionOf(source)).not.toMatch(BASELINE_LITERAL);
  });

  it("코드 안의 기준선 리터럴은 그대로 남긴다", () => {
    const source = '// 주석\nconst target = "chrome80";';

    expect(codeRegionOf(source)).toMatch(BASELINE_LITERAL);
  });

  it("문자열 안의 슬래시 두 개를 주석으로 보지 않는다", () => {
    const source = 'const url = "https://example.com"; const target = "chrome80";';

    expect(codeRegionOf(source)).toMatch(BASELINE_LITERAL);
  });

  it("정규식 리터럴 안의 슬래시 두 개를 주석으로 보지 않는다", () => {
    const source = 'const doubleSlash = /\\/\\//; const target = "chrome80";';

    expect(codeRegionOf(source)).toMatch(BASELINE_LITERAL);
  });
it("실제 게이트 파일에서 코드는 남기고 주석만 지운다", () => {
    const code = codeRegionOf(readText(syntaxGatePath));

    expect(code).toContain("export async function findFirstSyntaxDivergence");
    expect(code).toContain("HOIST_LINE");
    expect(code).toContain("syntaxTarget.length === 0");
    expect(code).not.toContain("문법 검사 게이트다");
  });
});
