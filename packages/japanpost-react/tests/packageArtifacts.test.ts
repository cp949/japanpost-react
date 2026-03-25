import fs from "node:fs";
import path from "node:path";

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

describe("package artifacts", () => {
  it("publishes the files declared in package metadata", () => {
    const exportEntry = packageJson.exports?.["."] ?? {};
    const artifactPaths = [
      packageJson.main,
      packageJson.module,
      packageJson.types,
      exportEntry.import,
      exportEntry.require,
      exportEntry.types,
    ].filter((value): value is string => Boolean(value));

    expect(artifactPaths.length).toBeGreaterThan(0);

    for (const artifactPath of new Set(artifactPaths)) {
      expect(fs.existsSync(path.join(packageDir, artifactPath))).toBe(true);
    }
  });

  it("keeps English and Korean package readmes split by file", () => {
    const englishReadme = fs.readFileSync(packageReadmePath, "utf8");
    const koreanReadme = fs.readFileSync(packageReadmeKoPath, "utf8");
    const englishFirstLine = englishReadme.split("\n")[0];
    const koreanFirstLine = koreanReadme.split("\n")[0];

    expect(englishFirstLine).toBe("# @cp949/japanpost-react");
    expect(englishReadme).toContain("[한국어 README](./README.ko.md)");
    expect(englishReadme).not.toContain("[English](#english) | [한국어](#한국어)");
    expect(englishReadme).not.toContain("## 한국어");

    expect(koreanFirstLine).toBe("# @cp949/japanpost-react");
    expect(koreanReadme).toContain("[English README](./README.md)");
    expect(koreanReadme).not.toContain("## English");
  });
});

describe("demo workspace app", () => {
  it("declares a buildable demo app with the expected scripts and dependencies", () => {
    const demoAppDir = path.resolve(packageDir, "../../apps/demo");
    const demoPackageJsonPath = path.join(demoAppDir, "package.json");

    expect(fs.existsSync(demoPackageJsonPath)).toBe(true);

    const demoPackageJson = JSON.parse(
      fs.readFileSync(demoPackageJsonPath, "utf8"),
    ) as {
      name?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };

    expect(demoPackageJson.name).toBe("demo");
    expect(demoPackageJson.scripts).toEqual(
      expect.objectContaining({
        dev: "vite",
        build: "tsc -b && vite build",
        "check-types": "tsc --noEmit",
        lint: "biome lint .",
      }),
    );
    expect(demoPackageJson.dependencies).toEqual(
      expect.objectContaining({
        "@cp949/japanpost-react": "workspace:*",
        "@mui/material": expect.any(String),
        react: expect.any(String),
        "react-dom": expect.any(String),
      }),
    );
  });
});
