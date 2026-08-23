import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkPackageBaseline, formatReport } from "@repo/browser-baseline";
import type { DependencyFinding } from "@repo/browser-baseline";

const fixturesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/browser-baseline",
);

/** dependency finding만 골라 정확한 closure 판정을 비교한다. */
function dependencyFindings(
  findings: Awaited<ReturnType<typeof checkPackageBaseline>>["findings"],
): DependencyFinding[] {
  return findings.filter(
    (finding): finding is DependencyFinding => finding.kind === "dependency",
  );
}

/** 매니페스트 경계 오류를 실제 공개 검사 경로로 재현할 임시 패키지를 만든다. */
async function withTemporaryPackage(
  manifest: Record<string, unknown>,
  run: (packageDir: string) => Promise<void>,
  source = "export const value = 1;\n",
): Promise<void> {
  const packageDir = await mkdtemp(
    path.join(tmpdir(), "browser-baseline-manifest-"),
  );

  try {
    await mkdir(path.join(packageDir, "bundle"));
    await writeFile(
      path.join(packageDir, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await writeFile(path.join(packageDir, "bundle/index.mjs"), source);
    await run(packageDir);
  } finally {
    await rm(packageDir, { recursive: true, force: true });
  }
}

const validManifest = {
  name: "fixture-valid-manifest",
  version: "0.0.0",
  private: true,
  browserslist: ["chrome >= 80"],
  exports: { ".": { import: "./bundle/index.mjs" } },
};

describe("dependency closure 게이트", () => {
  it("static import attributes를 포함한 self와 peer의 ESM·CJS 서브패스만 외부 참조로 허용한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-clean");

    const result = await checkPackageBaseline({ packageDir });

    expect(result.ok).toBe(true);
    expect(dependencyFindings(result.findings)).toEqual([]);
  });

  it("static import attributes의 dependency 누출은 정확한 finding으로 실패한다", async () => {
    await withTemporaryPackage(
      {
        ...validManifest,
        browserslist: ["chrome >= 123"],
        dependencies: { "runtime-dep": "*" },
      },
      async (packageDir) => {
        const result = await checkPackageBaseline({ packageDir });

        expect(dependencyFindings(result.findings)).toEqual([
          {
            kind: "dependency",
            file: "bundle/index.mjs",
            line: 1,
            specifier: "runtime-dep/config",
            packageRoot: "runtime-dep",
            issue: "dependency-leak",
            text: 'import value from "runtime-dep/config" with { type: "json" };',
          },
        ]);
      },
      'import value from "runtime-dep/config" with { type: "json" };\n',
    );
  });

  it("dependency·optional·미선언·Node 내장·계산형 specifier를 구분한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(dependencyFindings(result.findings)).toEqual([
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 2,
        specifier: "fs/promises",
        packageRoot: "fs",
        issue: "node-builtin",
        text: 'const fsPromises = require("fs/promises");',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 3,
        specifier: "node:fs",
        packageRoot: "node:fs",
        issue: "node-builtin",
        text: 'const fsModule = require("node:fs");',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 4,
        specifier: "runtime-dep",
        packageRoot: "runtime-dep",
        issue: "dependency-leak",
        text: 'const runtimeValue = require("runtime-dep");',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 5,
        specifier: "optional-dep",
        packageRoot: "optional-dep",
        issue: "optional-dependency-leak",
        text: "const optionalValue = require(`optional-dep`);",
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 7,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: "require(requested);",
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 8,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: "require();",
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 9,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: 'require("runtime-dep", "extra");',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "a-sort-dep",
        packageRoot: "a-sort-dep",
        issue: "dependency-leak",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "z-sort-dep",
        packageRoot: "z-sort-dep",
        issue: "dependency-leak",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "a-undeclared",
        packageRoot: "a-undeclared",
        issue: "undeclared-runtime",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 11,
        specifier: "\uE000",
        packageRoot: "\uE000",
        issue: "dependency-leak",
        text: 'const unicode = [require("\uE000"), require("\u{10000}")];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 11,
        specifier: "\u{10000}",
        packageRoot: "\u{10000}",
        issue: "dependency-leak",
        text: 'const unicode = [require("\uE000"), require("\u{10000}")];',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 1,
        specifier: "runtime-dep/subpath",
        packageRoot: "runtime-dep",
        issue: "dependency-leak",
        text: 'import value from "runtime-dep/subpath";',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 2,
        specifier: "optional-dep/feature",
        packageRoot: "optional-dep",
        issue: "optional-dependency-leak",
        text: 'export { optionalValue } from "optional-dep/feature";',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 3,
        specifier: "@scope/runtime-dep/feature",
        packageRoot: "@scope/runtime-dep",
        issue: "dependency-leak",
        text: 'export * from "@scope/runtime-dep/feature";',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 4,
        specifier: "@scope/undeclared/subpath",
        packageRoot: "@scope/undeclared",
        issue: "undeclared-runtime",
        text: 'import "@scope/undeclared/subpath";',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 5,
        specifier: "dev-only/tool",
        packageRoot: "dev-only",
        issue: "undeclared-runtime",
        text: 'import("dev-only/tool");',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 6,
        specifier: "@scope/dev-only/tool",
        packageRoot: "@scope/dev-only",
        issue: "undeclared-runtime",
        text: "import(`@scope/dev-only/tool`);",
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 7,
        specifier: "@scope",
        packageRoot: null,
        issue: "undeclared-runtime",
        text: 'import "@scope";',
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 9,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: "import(requested);",
      },
      {
        kind: "dependency",
        file: "bundle/index.mjs",
        line: 10,
        specifier: "runtime-dep/options",
        packageRoot: "runtime-dep",
        issue: "dependency-leak",
        text: 'import("runtime-dep/options", { with: { type: "json" } });',
      },
    ]);
  });

  it("선언한 dependency의 bare import가 dist에 없으면 기존 API finding만 보존한다", async () => {
    const packageDir = path.join(fixturesDir, "violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(dependencyFindings(result.findings)).toEqual([]);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ kind: "api", name: ".at()" }),
    );
  });

  it("dependencies와 optionalDependencies가 겹치면 optional leak을 우선한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(dependencyFindings(result.findings)).toContainEqual({
      kind: "dependency",
      file: "bundle/index.mjs",
      line: 2,
      specifier: "optional-dep/feature",
      packageRoot: "optional-dep",
      issue: "optional-dependency-leak",
      text: 'export { optionalValue } from "optional-dep/feature";',
    });
  });

  it("같은 line은 issue 우선 뒤 같은 issue에서 specifier code-point 순으로 정렬한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(
      dependencyFindings(result.findings).filter(
        (finding) => finding.file === "bundle/index.cjs" && finding.line === 10,
      ),
    ).toEqual([
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: null,
        packageRoot: null,
        issue: "computed-specifier",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "a-sort-dep",
        packageRoot: "a-sort-dep",
        issue: "dependency-leak",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "z-sort-dep",
        packageRoot: "z-sort-dep",
        issue: "dependency-leak",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 10,
        specifier: "a-undeclared",
        packageRoot: "a-undeclared",
        issue: "undeclared-runtime",
        text: 'const s = [require("z-sort-dep"), require("a-sort-dep"), require("a-undeclared"), require(requested)];',
      },
    ]);
  });

  it("같은 line과 issue의 specifier는 Unicode code-point 순으로 정렬한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-violations");

    const result = await checkPackageBaseline({ packageDir });

    expect(
      dependencyFindings(result.findings).filter(
        (finding) => finding.file === "bundle/index.cjs" && finding.line === 11,
      ),
    ).toEqual([
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 11,
        specifier: "\uE000",
        packageRoot: "\uE000",
        issue: "dependency-leak",
        text: 'const unicode = [require("\uE000"), require("\u{10000}")];',
      },
      {
        kind: "dependency",
        file: "bundle/index.cjs",
        line: 11,
        specifier: "\u{10000}",
        packageRoot: "\u{10000}",
        issue: "dependency-leak",
        text: 'const unicode = [require("\uE000"), require("\u{10000}")];',
      },
    ]);
  });

  it("self 이름이 fs여도 Node 내장 import는 node-builtin으로 실패한다", async () => {
    await withTemporaryPackage(
      { ...validManifest, name: "fs" },
      async (packageDir) => {
        const result = await checkPackageBaseline({ packageDir });

        expect(dependencyFindings(result.findings)).toEqual([
          {
            kind: "dependency",
            file: "bundle/index.mjs",
            line: 1,
            specifier: "fs/promises",
            packageRoot: "fs",
            issue: "node-builtin",
            text: 'import "fs/promises";',
          },
        ]);
      },
      'import "fs/promises";\n',
    );
  });

  it("Windows 정적 로컬 경로는 전역 require에서 closure 위반으로 세지 않는다", async () => {
    await withTemporaryPackage(
      {
        ...validManifest,
        dependencies: { "runtime-dep": "*" },
      },
      async (packageDir) => {
        const result = await checkPackageBaseline({ packageDir });

        expect(dependencyFindings(result.findings)).toEqual([
          {
            kind: "dependency",
            file: "bundle/index.mjs",
            line: 6,
            specifier: "runtime-dep",
            packageRoot: "runtime-dep",
            issue: "dependency-leak",
            text: 'const bare = require("runtime-dep");',
          },
          {
            kind: "dependency",
            file: "bundle/index.mjs",
            line: 7,
            specifier: "fs",
            packageRoot: "fs",
            issue: "node-builtin",
            text: 'const builtin = require("fs");',
          },
        ]);
      },
      String.raw`const relative = require(".\\local.cjs");
const parent = require("..\\shared.cjs");
const drive = require("C:\\workspace\\chunk.cjs");
const rooted = require("\\rooted\\chunk.cjs");
const unc = require("\\\\server\\share\\chunk.cjs");
const bare = require("runtime-dep");
const builtin = require("fs");
const url = require("https://example.test/chunk.cjs");
const driveRelative = require("C:chunk.cjs");
`,
    );
  });

  it.each([
    ["LF", "\n"],
    ["lone CR", "\r"],
    ["CRLF", "\r\n"],
    ["U+2028", "\u2028"],
    ["U+2029", "\u2029"],
  ])(
    "%s 줄바꿈 뒤 import source text와 줄 번호를 보존한다",
    async (_terminatorName, terminator) => {
      await withTemporaryPackage(
        {
          ...validManifest,
          dependencies: { "runtime-dep": "*" },
        },
        async (packageDir) => {
          const result = await checkPackageBaseline({ packageDir });

          expect(dependencyFindings(result.findings)).toEqual([
            {
              kind: "dependency",
              file: "bundle/index.mjs",
              line: 3,
              specifier: "runtime-dep",
              packageRoot: "runtime-dep",
              issue: "dependency-leak",
              text: 'import "runtime-dep";',
            },
          ]);
        },
        `const before = 1;${terminator}${terminator}import "runtime-dep";${terminator}`,
      );
    },
  );

  it("빈 scoped package root는 미선언 runtime으로 정확히 보고한다", async () => {
    await withTemporaryPackage(
      validManifest,
      async (packageDir) => {
        const result = await checkPackageBaseline({ packageDir });

        expect(dependencyFindings(result.findings)).toEqual([
          {
            kind: "dependency",
            file: "bundle/index.mjs",
            line: 1,
            specifier: "@/bad",
            packageRoot: null,
            issue: "undeclared-runtime",
            text: 'import "@/bad";',
          },
        ]);
      },
      'import "@/bad";\n',
    );
  });

  it("malformed dist는 API 재파싱 없이 ErrorFinding 한 건만 남긴다", async () => {
    await withTemporaryPackage(
      validManifest,
      async (packageDir) => {
        const result = await checkPackageBaseline({ packageDir });

        expect(result.findings).toEqual([
          {
            kind: "error",
            file: "bundle/index.mjs",
            message:
              "bundle/index.mjs을 파싱할 수 없다: Unexpected token (2:15)",
          },
        ]);
      },
      'import "runtime-dep";\nconst broken = ;\n',
    );
  });

  it.each([
    ["name", { ...validManifest, name: " " }],
    ["peerDependencies", { ...validManifest, peerDependencies: [] }],
    ["dependencies", { ...validManifest, dependencies: null }],
    ["optionalDependencies", { ...validManifest, optionalDependencies: "x" }],
  ])(
    "유효하지 않은 %s 필드는 package.json 경로와 함께 거부한다",
    async (field, manifest) => {
      await withTemporaryPackage(manifest, async (packageDir) => {
        await expect(checkPackageBaseline({ packageDir })).rejects.toThrow(
          new RegExp(`package\\.json.*${field}`),
        );
      });
    },
  );
});

describe("dependency closure 보고서", () => {
  it("파일별 건수와 다섯 원인을 서로 다른 한국어 진단으로 표시한다", async () => {
    const packageDir = path.join(fixturesDir, "dependency-closure-violations");
    const result = await checkPackageBaseline({ packageDir });

    const lines = formatReport(result);
    const report = lines.join("\n");

    expect(lines).toContain(
      "[dependency] bundle/index.cjs: dependency closure 위반 13건",
    );
    expect(lines).toContain(
      "[dependency] bundle/index.mjs: dependency closure 위반 9건",
    );
    expect(report).toContain(
      "runtime-dep/subpath -> runtime-dep (번들되어야 할 dependency가 외부 import로 남았다.)",
    );
    expect(report).toContain(
      "optional-dep/feature -> optional-dep (optionalDependency가 외부 import로 남았다.)",
    );
    expect(report).toContain(
      "@scope/undeclared/subpath -> @scope/undeclared (package.json에 선언되지 않은 runtime dependency다.)",
    );
    expect(report).toContain(
      "fs/promises -> fs (브라우저 dist가 Node 내장 모듈을 참조한다.)",
    );
    expect(report).toContain(
      "line 9: 계산형 specifier (계산형 specifier는 dependency closure를 판정할 수 없다.)",
    );
    expect(report).toContain('import value from "runtime-dep/subpath";');
    expect(report).not.toContain("null");
    expect(report).toContain("문법은 chrome80, 런타임 API는 Chrome 80");
    expect(report).toContain("dependency closure");
  });
});
