#!/usr/bin/env node
/**
 * @repo/browser-baseline CLI다.
 *
 * 판정은 checkPackageBaseline이, 표시는 formatReport가 한다.
 * 이 스크립트는 인자를 읽어 그 둘을 호출하고 종료 코드를 정할 뿐이다 —
 * 판정이나 포매팅 로직을 여기 다시 두지 않는다.
 *
 * 지원 서브커맨드는 check 하나다. 인자가 어긋나면 사용법을 찍고 exit 2,
 * 검사가 실패하면 exit 1, 통과하면 exit 0이다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";

import { checkPackageBaseline, formatReport } from "../src/index.mjs";

const USAGE = `사용법: browser-baseline check [--dir <path>]

  check       패키지 dist 산출물을 브라우저 지원 계약으로 검사한다.
  --dir       검사할 패키지 디렉터리. 기본값은 현재 작업 디렉터리다.`;

/**
 * process.argv를 파싱한다.
 * check 서브커맨드가 아니거나 알 수 없는 인자를 만나면 사용법을 찍고 exit 2다.
 */
function parseArgs(argv) {
  const [subcommand, ...rest] = argv;

  if (subcommand !== "check") {
    console.error(USAGE);
    process.exit(2);
  }

  let dir = process.cwd();

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];

    if (arg === "--dir") {
      const value = rest[i + 1];

      if (value === undefined) {
        console.error(USAGE);
        process.exit(2);
      }

      dir = value;
      i += 1;
      continue;
    }

    console.error(USAGE);
    process.exit(2);
  }

  return { dir };
}

const { dir } = parseArgs(process.argv.slice(2));
const packageDir = path.resolve(dir);

// allow는 프로젝트 데이터라 package.json에서 직접 읽는다.
// 필드가 없으면 빈 목록이지만, package.json 자체를 못 읽으면 던진다 —
// 조용히 넘어가면 게이트가 오탐 예외 없이 도는데도 통과한 것처럼 보인다.
const manifestPath = path.join(packageDir, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const allow = manifest.browserBaseline?.allow ?? [];

const result = await checkPackageBaseline({ packageDir, allow });
const lines = formatReport(result);

if (result.ok) {
  for (const line of lines) {
    console.log(line);
  }
} else {
  for (const line of lines) {
    console.error(line);
  }

  process.exit(1);
}
