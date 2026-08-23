import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkPackageBaseline } from "@repo/browser-baseline";

/**
 * bin/browser-baseline.mjs의 공개 표면 검증이다.
 *
 * 다른 테스트는 전부 배럴을 import해 checkPackageBaseline을 직접 부른다.
 * 그 경로는 종료 코드도, 어느 스트림에 찍는지도 지나가지 않는다 — CLI가
 * 정하는 부분이 바로 그 둘이고, pnpm build가 게이트를 부르는 유일한
 * 진입점도 이 CLI다. 그래서 여기서는 프로세스를 실제로 띄워
 * exit code·stdout·stderr를 그대로 본다.
 *
 * API와 dependency closure 사례는 각 check 테스트와 같은 픽스처를 쓴다.
 * 잘못된 manifest 사례만 이 파일에서 임시 패키지를 만들어 CLI 경계를 확인한다.
 */
const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../..");
const cliPath = path.join(
  repoRoot,
  "packages/browser-baseline/bin/browser-baseline.mjs",
);
const fixturesDir = path.join(testDir, "fixtures/browser-baseline");

interface CliRun {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** CLI를 자식 프로세스로 띄워 종료 코드와 두 스트림을 그대로 모은다. */
function runCli(args: string[]): Promise<CliRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe("browser-baseline CLI: 종료 코드와 스트림이 계약대로 갈린다", () => {
  it("기존 API 위반이 없으면 exit 0과 stdout 통과 문구만 남긴다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(fixturesDir, "clean"),
    ]);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain("통과");
    // 통과 출력이 stderr로 새면 CI 로그에서 실패처럼 읽힌다.
    expect(run.stderr).toBe("");
  });

  it("기존 API 위반은 exit 1과 stderr 진단만 남긴다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(fixturesDir, "violations"),
    ]);

    expect(run.code).toBe(1);
    expect(run.stderr).toContain("[api]");
    expect(run.stderr).toContain("실패");
    // 진단이 stdout으로 새면 파이프로 받는 쪽이 통과 출력과 구별하지 못한다.
    expect(run.stdout).toBe("");
  });

  it("알 수 없는 서브커맨드는 exit 2로 끝나고 사용법을 stderr에 낸다", async () => {
    const run = await runCli(["verify"]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain("사용법: browser-baseline check");
    expect(run.stdout).toBe("");
  });

  it("알 수 없는 플래그는 exit 2로 끝나고 사용법을 stderr에 낸다", async () => {
    const run = await runCli(["check", "--package"]);

    expect(run.code).toBe(2);
    expect(run.stderr).toContain("사용법: browser-baseline check");
    expect(run.stdout).toBe("");
  });
});

describe("browser-baseline CLI: dependency closure 결과도 같은 종료 계약을 쓴다", () => {
  it("closure 위반이 없으면 exit 0과 stdout 통과 문구만 남긴다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(fixturesDir, "dependency-closure-clean"),
    ]);

    expect(run.code).toBe(0);
    expect(run.stdout).toContain("통과");
    expect(run.stderr).toBe("");
  });

  it("closure 위반은 exit 1과 stderr dependency 진단만 남긴다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(fixturesDir, "dependency-closure-violations"),
    ]);

    expect(run.code).toBe(1);
    expect(run.stdout).toBe("");
    expect(run.stderr).toContain("[dependency]");
    expect(run.stderr).toContain("실패");
  });
});

describe("browser-baseline CLI: 검사를 시작하지 못한 오류는 위반과 다른 코드다", () => {
  it("읽을 수 없는 --dir은 exit 2로 끝나고 스택 없이 한 줄만 낸다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(repoRoot, "존재하지-않는-디렉터리"),
    ]);

    // 위반(1)이 아니다. 검사를 시작조차 못 한 상태다.
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("ENOENT");
    // 스택 덤프가 다시 새어 나오면 여기서 잡힌다.
    expect(run.stderr).not.toContain("    at ");
    expect(run.stderr.trimEnd().split("\n")).toHaveLength(1);
  });

  it("browserslist가 없는 픽스처는 위반이 아니라 exit 2로 끝난다", async () => {
    const run = await runCli([
      "check",
      "--dir",
      path.join(fixturesDir, "no-browserslist"),
    ]);

    // 경계는 폴백하지 않고 던진다. CLI는 그 던짐을 위반(1)과 갈라 놓는다.
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("browserslist");
    expect(run.stderr).not.toContain("    at ");
  });

  it("유효하지 않은 dependency 매니페스트는 exit 2와 스택 없는 한 줄로 끝난다", async () => {
    const packageDir = await mkdtemp(
      path.join(tmpdir(), "browser-baseline-cli-manifest-"),
    );

    try {
      await mkdir(path.join(packageDir, "bundle"));
      await writeFile(
        path.join(packageDir, "package.json"),
        `${JSON.stringify({
          name: "",
          browserslist: ["chrome >= 80"],
          exports: { ".": { import: "./bundle/index.mjs" } },
        })}\n`,
      );
      await writeFile(
        path.join(packageDir, "bundle/index.mjs"),
        "export const value = 1;\n",
      );

      const run = await runCli(["check", "--dir", packageDir]);

      expect(run.code).toBe(2);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("package.json");
      expect(run.stderr).toContain("name");
      expect(run.stderr).not.toContain("    at ");
      expect(run.stderr.trimEnd().split("\n")).toHaveLength(1);
    } finally {
      await rm(packageDir, { recursive: true, force: true });
    }
  });
});

describe("browser-baseline CLI: package.json의 browserBaseline.allow를 직접 읽는다", () => {
  it("allow를 넘기지 않는 라이브러리 호출은 위반이 남지만 CLI는 통과시킨다", async () => {
    const packageDir = path.join(fixturesDir, "with-allow");

    // 대조군: allow 없이 같은 픽스처를 검사하면 실제로 위반이 있다.
    // 이게 없으면 CLI의 exit 0이 "allow를 읽어 지웠다"인지
    // "애초에 위반이 없었다"인지 구별되지 않는다.
    const withoutAllow = await checkPackageBaseline({ packageDir });

    expect(withoutAllow.ok).toBe(false);

    const run = await runCli(["check", "--dir", packageDir]);

    // CLI만이 package.json에서 browserBaseline.allow를 읽는다.
    // 그 경로가 끊기면 위 대조군과 같은 위반이 남아 exit 1이 된다.
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("통과");
  });
});
