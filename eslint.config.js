import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import tseslint from "typescript-eslint";
import compat from "eslint-plugin-compat";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

// react/react-hooks/react-refresh 규칙이 필요한 워크스페이스만 명시한다.
// apps/minimal-api, packages/browser-baseline은 React를 쓰지 않는 순수 Node 코드다.
const REACT_FILES = [
  "apps/demo/**/*.{ts,tsx}",
  "packages/japanpost-react/**/*.{ts,tsx}",
];

const repoRoot = path.dirname(fileURLToPath(import.meta.url));

/** browserslist 계약이 있는 워크스페이스 패키지의 소스 glob을 찾는다. */
function packagesWithBrowserslist(rootDirs) {
  const patterns = [];

  for (const rootDir of rootDirs) {
    const workspaceRoot = path.join(repoRoot, rootDir);
    if (!existsSync(workspaceRoot)) continue;

    for (const entry of readdirSync(workspaceRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const packageJsonPath = path.join(
        workspaceRoot,
        entry.name,
        "package.json",
      );
      if (!existsSync(packageJsonPath)) continue;

      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (
        Array.isArray(packageJson.browserslist) &&
        packageJson.browserslist.length > 0
      ) {
        patterns.push(`${rootDir}/${entry.name}/src/**/*.{ts,tsx}`);
      }
    }
  }

  return patterns;
}

const BROWSER_COMPAT_FILES = packagesWithBrowserslist(["packages", "apps"]);

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.turbo/**",
      "_works/**",
      ".worktrees/**",
      ".secrets/**",
      "docs/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // TypeScript가 더 정확히 잡아내므로 base 규칙은 끄고 @typescript-eslint 쪽을 쓴다.
      "no-unused-vars": "off",
      "no-undef": "off",
      // biome의 noUnusedVariables와 동일하게 `_` 접두사는 의도적 미사용으로 취급한다.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: REACT_FILES,
    ...react.configs.flat.recommended,
    ...react.configs.flat["jsx-runtime"],
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      globals: { ...globals.browser },
    },
    plugins: {
      ...react.configs.flat.recommended.plugins,
      "react-hooks": reactHooks,
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      // react-hooks v7의 recommended는 React Compiler 파생 규칙까지 포함해 범위가 넓다.
      // biome 대체 목적에 맞춰 안정적인 두 규칙만 켠다.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["apps/demo/**/*.{ts,tsx}"],
    plugins: { "react-refresh": reactRefresh },
    rules: {
      "react-refresh/only-export-components": "warn",
    },
  },
  {
    files: BROWSER_COMPAT_FILES,
    ...compat.configs["flat/recommended"],
    rules: {
      ...compat.configs["flat/recommended"].rules,
      "compat/compat": "warn",
    },
  },
  prettierConfig,
);
