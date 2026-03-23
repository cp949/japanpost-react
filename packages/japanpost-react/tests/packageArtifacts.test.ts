import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const packageDir = path.resolve(import.meta.dirname, "..");
const packageJsonPath = path.join(packageDir, "package.json");
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
});
