import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const packageDir = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(packageDir, "package.json");
const packageReadmePath = path.join(packageDir, "README.md");
const packageReadmeKoPath = path.join(packageDir, "README.ko.md");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
  main?: string;
  module?: string;
  types?: string;
  exports?: Record<
    string,
    {
      import?: string;
      require?: string;
      types?: string;
    }
  >;
};

function createPackedConsumerProject(): {
  cleanup: () => void;
  consumerDir: string;
  tarballPath: string;
} {
  const sandboxDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "japanpost-react-pack-consumer-"),
  );
  const tarballDir = path.join(sandboxDir, "pack");
  const consumerDir = path.join(sandboxDir, "consumer");

  fs.mkdirSync(tarballDir, { recursive: true });
  fs.mkdirSync(consumerDir, { recursive: true });
  fs.writeFileSync(
    path.join(consumerDir, "package.json"),
    JSON.stringify(
      {
        name: "japanpost-react-pack-consumer",
        private: true,
      },
      null,
      2,
    ),
  );

  execFileSync(
    "pnpm",
    ["pack", "--pack-destination", tarballDir],
    {
      cwd: packageDir,
      encoding: "utf8",
    },
  );

  const [tarballName] = fs
    .readdirSync(tarballDir)
    .filter((entry) => entry.endsWith(".tgz"));

  if (!tarballName) {
    throw new Error("Expected pnpm pack to produce a tarball");
  }

  const tarballPath = path.join(tarballDir, tarballName);

  execFileSync(
    "pnpm",
    [
      "add",
      tarballPath,
      "react",
      "react-dom",
      "-D",
      "typescript",
      "@types/react",
      "@types/react-dom",
    ],
    {
      cwd: consumerDir,
      encoding: "utf8",
    },
  );

  return {
    cleanup: () => fs.rmSync(sandboxDir, { force: true, recursive: true }),
    consumerDir,
    tarballPath,
  };
}

function runPackedConsumerTypecheck(
  consumerDir: string,
  source: string,
  fileName = "index.ts",
): string {
  fs.writeFileSync(
    path.join(consumerDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          jsx: "react-jsx",
        },
        include: [fileName],
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(path.join(consumerDir, fileName), source);

  return execFileSync(
    "pnpm",
    ["exec", "tsc", "--project", "tsconfig.json"],
    {
      cwd: consumerDir,
      encoding: "utf8",
    },
  );
}

describe("package artifacts", () => {
  it("declares an ESM-only root package contract", () => {
    const exportEntry = packageJson.exports?.["."] ?? {};

    expect(exportEntry.import).toBe("./dist/index.es.js");
    expect(exportEntry.types).toBe("./dist/index.d.ts");
    expect(exportEntry.require).toBeUndefined();
    expect(packageJson.main).toBe("dist/index.es.js");
    expect(packageJson.module).toBe("dist/index.es.js");
    expect(packageJson.types).toBe("dist/index.d.ts");
  });

  it("publishes only the expected ESM runtime artifacts", () => {
    const clientExportEntry = packageJson.exports?.["./client"] ?? {};
    const runtimeArtifacts = [
      packageJson.main,
      packageJson.module,
      packageJson.exports?.["."]?.import,
      clientExportEntry.import,
    ].filter((value): value is string => Boolean(value));

    expect(runtimeArtifacts).toContain("dist/index.es.js");
    expect(runtimeArtifacts).toContain("./dist/client.es.js");
    expect(runtimeArtifacts).not.toContain("dist/index.umd.cjs");
    expect(fs.existsSync(path.join(packageDir, "dist/index.es.js"))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, "dist/client.es.js"))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, "dist/index.umd.cjs"))).toBe(false);

    for (const artifactPath of new Set(runtimeArtifacts)) {
      expect(fs.existsSync(path.join(packageDir, artifactPath))).toBe(true);
    }
  });

  it("publishes a dedicated client entry for Next.js client components", () => {
    const clientExportEntry = packageJson.exports?.["./client"] ?? {};
    const clientImportPath = clientExportEntry.import;
    const clientTypesPath = clientExportEntry.types;

    expect(clientImportPath).toBeTruthy();
    expect(clientTypesPath).toBeTruthy();

    if (!clientImportPath || !clientTypesPath) {
      throw new Error("Client export entry must include import and types paths");
    }

    expect(fs.existsSync(path.join(packageDir, clientImportPath))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, clientTypesPath))).toBe(true);

    const clientEntrySource = fs.readFileSync(
      path.join(packageDir, clientImportPath),
      "utf8",
    );

    expect(clientEntrySource.startsWith('"use client";')).toBe(true);
  });

  it("does not publish a dedicated contracts entry", () => {
    expect(packageJson.exports?.["./contracts"]).toBeUndefined();
  });

  it("publishes non-empty root and client type entrypoints", () => {
    const rootTypesPath = packageJson.types;
    const exportTypesPath = packageJson.exports?.["."]?.types;
    const clientTypesPath = packageJson.exports?.["./client"]?.types;

    expect(rootTypesPath).toBeTruthy();
    expect(exportTypesPath).toBeTruthy();
    expect(clientTypesPath).toBeTruthy();

    if (!rootTypesPath || !exportTypesPath || !clientTypesPath) {
      throw new Error("Package type entrypoints must all be defined");
    }

    const rootTypesSource = fs.readFileSync(
      path.join(packageDir, rootTypesPath),
      "utf8",
    );
    const exportedRootTypesSource = fs.readFileSync(
      path.join(packageDir, exportTypesPath),
      "utf8",
    );
    const clientTypesSource = fs.readFileSync(
      path.join(packageDir, clientTypesPath),
      "utf8",
    );

    expect(rootTypesSource.trim()).not.toBe("export {}");
    expect(exportedRootTypesSource).toBe(rootTypesSource);
    expect(clientTypesPath).toBe("./dist/client.d.ts");
    expect(clientTypesSource.trim()).not.toBe("export {}");
    expect(clientTypesSource.trim()).not.toHaveLength(0);
  });

  it("keeps the published ESM entry importable in Node ESM environments", () => {
    const exportEntry = packageJson.exports?.["."] ?? {};
    const importPath = exportEntry.import;

    expect(importPath).toBeTruthy();

    const stdout = execFileSync(
      "node",
      [
        "--input-type=module",
        "-e",
        `import(${JSON.stringify(`./${importPath}`)}).then(() => console.log("import-ok"))`,
      ],
      {
        cwd: packageDir,
        encoding: "utf8",
      },
    );

    expect(stdout.trim()).toBe("import-ok");
  });

  it("keeps the packed tarball importable only through ESM package exports", () => {
    const { cleanup, consumerDir, tarballPath } = createPackedConsumerProject();

    try {
      const tarballEntries = execFileSync("tar", ["-tzf", tarballPath], {
        encoding: "utf8",
      })
        .trim()
        .split("\n");

      expect(tarballEntries).toContain("package/dist/index.es.js");
      expect(tarballEntries).toContain("package/dist/client.es.js");
      expect(tarballEntries).toContain("package/dist/index.d.ts");
      expect(tarballEntries).toContain("package/dist/client.d.ts");
      expect(tarballEntries).not.toContain("package/dist/contracts.es.js");
      expect(tarballEntries).not.toContain("package/dist/contracts.d.ts");
      expect(tarballEntries).not.toContain("package/dist/index.umd.cjs");

      const importStdout = execFileSync(
        "node",
        [
          "--input-type=module",
          "-e",
          'import("@cp949/japanpost-react").then(() => console.log("import-ok"))',
        ],
        {
          cwd: consumerDir,
          encoding: "utf8",
        },
      );

      expect(importStdout.trim()).toBe("import-ok");

      const clientImportStdout = execFileSync(
        "node",
        [
          "--input-type=module",
          "-e",
          'import("@cp949/japanpost-react/client").then(() => console.log("import-client-ok"))',
        ],
        {
          cwd: consumerDir,
          encoding: "utf8",
        },
      );

      expect(clientImportStdout.trim()).toBe("import-client-ok");
      expect(() =>
        execFileSync(
          "node",
          [
            "--input-type=module",
            "-e",
            'import("@cp949/japanpost-react/contracts").then(() => console.log("import-contracts-ok"))',
          ],
          {
            cwd: consumerDir,
            encoding: "utf8",
          },
        ),
      ).toThrowError(/ERR_PACKAGE_PATH_NOT_EXPORTED/);
      expect(() =>
        execFileSync(
          "node",
          [
            "-e",
            'require("@cp949/japanpost-react"); console.log("require-ok")',
          ],
          {
            cwd: consumerDir,
            encoding: "utf8",
          },
        ),
      ).toThrowError(/ERR_PACKAGE_PATH_NOT_EXPORTED/);
      expect(() =>
        execFileSync(
          "node",
          [
            "-e",
            'require("@cp949/japanpost-react/client"); console.log("require-client-ok")',
          ],
          {
            cwd: consumerDir,
            encoding: "utf8",
          },
        ),
      ).toThrowError(/ERR_PACKAGE_PATH_NOT_EXPORTED/);
      expect(() =>
        execFileSync(
          "node",
          [
            "-e",
            'require("@cp949/japanpost-react/contracts"); console.log("require-contracts-ok")',
          ],
          {
            cwd: consumerDir,
            encoding: "utf8",
          },
        ),
      ).toThrowError(/ERR_PACKAGE_PATH_NOT_EXPORTED/);
    } finally {
      cleanup();
    }
  });

  it("keeps the packed root types importable for consumers", () => {
    const { cleanup, consumerDir } = createPackedConsumerProject();

    try {
      const typecheckStdout = runPackedConsumerTypecheck(
        consumerDir,
        [
          'import type {',
          "  JapanAddress,",
          "  JapanPostAddresszipRequest,",
          "  NormalizedJapanAddressRecord,",
          "  Page,",
          '} from "@cp949/japanpost-react";',
          "",
          "const request: JapanPostAddresszipRequest = {",
          '  addressQuery: "Chiyoda",',
          "  pageNumber: 0,",
          "  rowsPerPage: 20,",
          "};",
          "",
          "declare const page: Page<JapanAddress>;",
          "declare const normalized: NormalizedJapanAddressRecord;",
          "const postalCode: string = normalized.postalCode;",
          "const detail: string | undefined = normalized.detail;",
          "void request;",
          "void page;",
          "void normalized;",
          "void postalCode;",
          "void detail;",
          "",
        ].join("\n"),
      );

      expect(typecheckStdout).toBe("");
    } finally {
      cleanup();
    }
  });

  it("keeps the packed client subpath types importable for consumers", () => {
    const { cleanup, consumerDir } = createPackedConsumerProject();

    try {
      const typecheckStdout = runPackedConsumerTypecheck(
        consumerDir,
        [
          'import type {',
          "  JapanAddress,",
          "  JapanAddressSearchInput,",
          "  UseJapanAddressResult,",
          '} from "@cp949/japanpost-react/client";',
          "",
          "const input: JapanAddressSearchInput = {",
          '  addressQuery: "Chiyoda",',
          "  pageNumber: 0,",
          "  rowsPerPage: 20,",
          "};",
          "",
          "const address: JapanAddress = {",
          '  postalCode: "1000001",',
          '  prefecture: "Tokyo",',
          '  city: "Chiyoda-ku",',
          '  town: "Chiyoda",',
          '  address: "Tokyo Chiyoda-ku Chiyoda",',
          '  provider: "japan-post",',
          "};",
          "",
          "declare const result: UseJapanAddressResult;",
          "void input;",
          "void address;",
          "void result;",
          "",
        ].join("\n"),
      );

      expect(typecheckStdout).toBe("");
    } finally {
      cleanup();
    }
  });

  it(
    "keeps the packed component refs typed as HTMLInputElement refs",
    () => {
      const { cleanup, consumerDir } = createPackedConsumerProject();

      try {
        const typecheckStdout = runPackedConsumerTypecheck(
          consumerDir,
          [
            'import { createRef } from "react";',
            'import { AddressSearchInput, PostalCodeInput } from "@cp949/japanpost-react";',
            "",
            "const postalRef = createRef<HTMLInputElement>();",
            "const addressRef = createRef<HTMLInputElement>();",
            "",
            "const postalElement = (",
            '  <PostalCodeInput onSearch={() => {}} ref={postalRef} />',
            ");",
            "",
            "const addressElement = (",
            '  <AddressSearchInput onSearch={() => {}} ref={addressRef} />',
            ");",
            "",
            "void postalElement;",
            "void addressElement;",
            "",
          ].join("\n"),
          "index.tsx",
        );

        expect(typecheckStdout).toBe("");
      } finally {
        cleanup();
      }
    },
    20_000,
  );

  it("keeps English and Korean package readmes split by file without reviving the removed subpath", () => {
    const englishReadme = fs.readFileSync(packageReadmePath, "utf8");
    const koreanReadme = fs.readFileSync(packageReadmeKoPath, "utf8");
    const englishFirstLine = englishReadme.split("\n")[0];
    const koreanFirstLine = koreanReadme.split("\n")[0];

    expect(englishFirstLine).toBe("# @cp949/japanpost-react");
    expect(englishReadme).toContain("[한국어 README](./README.ko.md)");
    expect(englishReadme).not.toContain("[English](#english) | [한국어](#한국어)");
    expect(englishReadme).not.toContain("## 한국어");
    expect(englishReadme).toContain("@cp949/japanpost-react/client");
    expect(englishReadme).not.toContain("@cp949/japanpost-react/contracts");

    expect(koreanFirstLine).toBe("# @cp949/japanpost-react");
    expect(koreanReadme).toContain("[English README](./README.md)");
    expect(koreanReadme).not.toContain("## English");
    expect(koreanReadme).toContain("@cp949/japanpost-react/client");
    expect(koreanReadme).not.toContain("@cp949/japanpost-react/contracts");
  });
});
