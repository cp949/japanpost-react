import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const demoAppDir = path.resolve(import.meta.dirname, "../../apps/demo");
const demoTsconfigPath = path.join(demoAppDir, "tsconfig.json");

function readDemoSourceFiles(currentDir: string): string[] {
  const entries = fs.readdirSync(currentDir, {
    withFileTypes: true,
  });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      files.push(...readDemoSourceFiles(entryPath));
      continue;
    }

    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fs.readFileSync(entryPath, "utf8"));
    }
  }

  return files;
}

describe("demo workspace app", () => {
  it("keeps demo tsconfig paths aligned with the recommended package subpaths", () => {
    expect(fs.existsSync(demoTsconfigPath)).toBe(true);

    const demoTsconfig = JSON.parse(fs.readFileSync(demoTsconfigPath, "utf8")) as {
      compilerOptions?: {
        paths?: Record<string, string[]>;
      };
    };

    const packagePaths = Object.fromEntries(
      Object.entries(demoTsconfig.compilerOptions?.paths ?? {}).filter(
        ([key]) => key.startsWith("@cp949/japanpost-react"),
      ),
    );

    expect(packagePaths).toEqual({
      "@cp949/japanpost-react": [
        "../../packages/japanpost-react/src/index.ts",
      ],
      "@cp949/japanpost-react/client": [
        "../../packages/japanpost-react/src/client.ts",
      ],
    });
  });

  it("only consumes supported package entrypoints in demo source", () => {
    const demoSourceFiles = readDemoSourceFiles(path.join(demoAppDir, "src"));
    const packageSpecifiers = demoSourceFiles.flatMap((source) =>
      [...source.matchAll(/@cp949\/japanpost-react(?:\/[a-z-]+)?/g)].map(
        (match) => match[0],
      ),
    );

    expect(packageSpecifiers.length).toBeGreaterThan(0);
    expect(packageSpecifiers).not.toContain("@cp949/japanpost-react/contracts");
    expect(
      packageSpecifiers.every(
        (specifier) =>
          specifier === "@cp949/japanpost-react" ||
          specifier === "@cp949/japanpost-react/client",
      ),
    ).toBe(true);
  });
});
