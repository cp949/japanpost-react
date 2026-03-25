import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { spawnCommand } from "./local-dev-utils.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, {
      cwd: ROOT_DIR,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (typeof code === "number" && code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${
            signal ? `signal ${signal}` : `exit code ${code ?? 1}`
          }`,
        ),
      );
    });
  });
}

async function main() {
  await runCommand("pnpm", ["readme:package:check"]);
  await runCommand("pnpm", ["--filter", "@cp949/japanpost-react", "test"]);
  await runCommand("pnpm", ["test:workspace"]);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
