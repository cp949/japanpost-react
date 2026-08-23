/** ESLint의 브라우저 호환성 조기 경고 적용 범위를 검증한다. */
import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { ESLint } from "eslint";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const execFileAsync = promisify(execFile);
let isolatedRepoRoot: string;
let discoveredAppDir: string;
let discoveredAppFile: string;

beforeAll(async () => {
  isolatedRepoRoot = await mkdtemp(
    path.join(tmpdir(), "japanpost-eslint-compat-"),
  );
  discoveredAppDir = "apps/discovered-browser-package";
  discoveredAppFile = path.join(discoveredAppDir, "src/__compat-probe.ts");
  const absoluteAppDir = path.join(isolatedRepoRoot, discoveredAppDir);

  await mkdir(absoluteAppDir, { recursive: true });
  await copyFile(
    path.join(repoRoot, "eslint.config.js"),
    path.join(isolatedRepoRoot, "eslint.config.js"),
  );
  await symlink(
    path.join(repoRoot, "node_modules"),
    path.join(isolatedRepoRoot, "node_modules"),
    "junction",
  );
  await writeFile(
    path.join(isolatedRepoRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
  );

  await writeFile(
    path.join(absoluteAppDir, "package.json"),
    JSON.stringify({
      name: "eslint-compat-discovery-fixture",
      private: true,
      browserslist: ["chrome >= 100"],
    }),
  );
});

afterAll(async () => {
  await rm(isolatedRepoRoot, { recursive: true, force: true });
});

/** 지정한 워크스페이스 파일에서 발생한 compat 규칙 메시지를 반환한다. */
async function lintCompatMessages(workspaceDir: string, filePath: string) {
  const eslint = new ESLint({ cwd: path.join(repoRoot, workspaceDir) });
  const [result] = await eslint.lintText("const tail = [1, 2].at(-1);", {
    filePath: path.join(repoRoot, filePath),
  });

  return result.messages.filter(
    (message) => message.ruleId === "compat/compat",
  );
}

describe("ESLint 브라우저 호환성 조기 경고", () => {
  it("새 browserslist 패키지를 자동 탐색하고 가장 가까운 계약을 사용한다", async () => {
    const workspacePath = path.join(isolatedRepoRoot, discoveredAppDir);
    const filePath = path.join(isolatedRepoRoot, discoveredAppFile);
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
          import { ESLint } from "eslint";
          const eslint = new ESLint({ cwd: process.argv[1] });
          const config = await eslint.calculateConfigForFile(process.argv[2]);
          const [result] = await eslint.lintText(
            "const tail = [1, 2].at(-1);",
            { filePath: process.argv[2] },
          );
          process.stdout.write(JSON.stringify({
            rule: config?.rules?.["compat/compat"],
            messages: result.messages.filter(
              (message) => message.ruleId === "compat/compat",
            ),
          }));
        `,
        workspacePath,
        filePath,
      ],
      { cwd: isolatedRepoRoot },
    );
    const result = JSON.parse(stdout);

    expect(result.rule).toEqual([1]);
    expect(result.messages).toHaveLength(0);
  });

  it("browserslist가 있는 패키지의 Chrome 80 미지원 API를 경고한다", async () => {
    const messages = await lintCompatMessages(
      "packages/japanpost-react",
      "packages/japanpost-react/src/__compat-probe.ts",
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe(1);
  });

  it("browserslist가 없는 app에는 compat 규칙을 적용하지 않는다", async () => {
    const messages = await lintCompatMessages(
      "apps/demo",
      "apps/demo/src/__compat-probe.ts",
    );

    expect(messages).toHaveLength(0);
  });
});
