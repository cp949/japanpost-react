#!/usr/bin/env node
/**
 * @repo/browser-baseline CLI다.
 *
 * 판정은 checkPackageBaseline이, 표시는 formatReport가 한다.
 * 이 스크립트는 인자를 읽어 그 둘을 호출하고 종료 코드를 정할 뿐이다 —
 * 판정이나 포매팅 로직을 여기 다시 두지 않는다.
 *
 * 지원 서브커맨드는 check 하나다. 종료 코드는 셋뿐이다 —
 * 0 통과, 1 계약 위반, 2 그 외 전부(사용법 오류와 검사를 시작하지 못한 오류).
 * 경계는 폴백하지 않고 던지는데, 그 던짐이 그대로 새어 나가면 스택 덤프가 되고
 * 종료 코드마저 위반과 같은 1이 된다. 아래에서 받아 2로 갈라 둔다.
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

try {
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
} catch (error) {
  // 여기 닿는 것은 계약 위반이 아니라 검사를 시작하지 못한 상태다 —
  // browserslist 부재, exports에 JS 산출물 없음, 읽을 수 없는 package.json,
  // 색인에 없는 allow 항목. 전부 부르는 쪽이 고칠 입력 문제이므로 사용법
  // 오류와 같은 exit 2로 묶는다. exit 1은 계약 위반 전용으로 남는다.
  //
  // 스택은 찍지 않는다. 위 오류는 전부 해소 방법을 메시지에 담아 던지므로
  // 프레임 목록이 진단에 보태는 것이 없고, 계약 오류를 내부 crash처럼 보이게 한다.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
