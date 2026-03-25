import { EventEmitter } from "node:events";

import { afterEach, describe, expect, it, vi } from "vitest";

type MockChildProcess = EventEmitter & {
  exitCode: number | null;
};

function createSuccessfulChild(): MockChildProcess {
  const child = new EventEmitter() as MockChildProcess;
  child.exitCode = null;

  queueMicrotask(() => {
    child.exitCode = 0;
    child.emit("exit", 0, null);
  });

  return child;
}

describe("root test script", () => {
  const originalArgv = process.argv.slice();

  afterEach(() => {
    process.argv = originalArgv.slice();
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("../../scripts/local-dev-utils.mjs");
  });

  it("forwards extra CLI args to the package and workspace test commands", async () => {
    const spawnCommand = vi.fn(() => createSuccessfulChild());

    vi.doMock("../../scripts/local-dev-utils.mjs", () => ({
      spawnCommand,
    }));

    process.argv = [
      "node",
      "scripts/test.mjs",
      "--runInBand",
      "--reporter=verbose",
    ];

    await import("../../scripts/test.mjs");

    await vi.waitFor(() => {
      expect(spawnCommand).toHaveBeenCalledTimes(3);
    });

    expect(spawnCommand.mock.calls).toContainEqual([
      "pnpm",
      [
        "--filter",
        "@cp949/japanpost-react",
        "test",
        "--",
        "--runInBand",
        "--reporter=verbose",
      ],
      expect.objectContaining({
        stdio: "inherit",
      }),
    ]);
    expect(spawnCommand.mock.calls).toContainEqual([
      "pnpm",
      ["test:workspace", "--", "--runInBand", "--reporter=verbose"],
      expect.objectContaining({
        stdio: "inherit",
      }),
    ]);
  });
});
