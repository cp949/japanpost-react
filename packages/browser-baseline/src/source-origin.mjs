/**
 * 소스맵에서 생성 코드의 줄 번호로 원본 소스 파일 경로를 찾는 조회기를 만든다.
 *
 * browser-baseline 게이트는 위반을 "dist/index.es.js:412" 형태로만 보고한다.
 * 원인이 된 원본 파일(예: "src/core/errors.ts")을 함께 내려면 빌드가 만든
 * 소스맵의 mappings를 직접 풀어야 한다. 이 module은 그 조회만 한다 — 맵 파일을
 * 찾아 읽는 일은 호출부 책임이다. fs에 접근하지 않아야 어떤 호출부(CLI, 테스트,
 * 다른 빌드 도구)에서도 그대로 재사용할 수 있다.
 *
 * 다른 module과 같은 규약이다: 계약을 벗어난 입력에는 폴백하지 않고 던진다.
 * 소스맵이 깨졌는데 조용히 null만 돌려주면 "원본을 못 찾았다"와 "맵 자체가
 * 잘못됐다"가 구분되지 않아 게이트가 엉뚱한 파일을 원인으로 지목할 수 있다.
 */
import path from "node:path";

/** Base64 VLQ 인코딩이 쓰는 문자표다. 소스맵 v3 명세가 고정한 순서다. */
const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** 문자 → 6비트 값 역색인이다. */
const BASE64_LOOKUP = new Map(
  [...BASE64_CHARS].map((char, index) => [char, index]),
);

/** 6비트 중 다음 문자로 값이 이어진다는 continuation 비트다. */
const CONTINUATION_BIT = 0x20;

/** continuation 비트를 뺀 나머지 5비트, 실제 값 조각이다. */
const DATA_MASK = 0x1f;

/**
 * Base64 VLQ 세그먼트 문자열 하나를 정수 배열로 푼다.
 *
 * 세그먼트 안의 필드(생성컬럼, sources인덱스, 원본줄, 원본컬럼, names인덱스)는
 * 구분자 없이 이어 붙어 있다 — continuation 비트만으로 필드 경계를 찾는다.
 * 각 값의 최하위 비트는 부호이고 나머지가 크기다.
 *
 * @param {string} text 세그먼트 하나의 VLQ 인코딩 문자열
 * @returns {number[]} 부호를 되살린 정수들, 필드 순서대로
 */
function decodeVlqFields(text) {
  const fields = [];
  let shift = 0;
  let value = 0;

  for (const char of text) {
    const digit = BASE64_LOOKUP.get(char);

    if (digit === undefined) {
      throw new Error(
        `소스맵 mappings에 base64 VLQ가 아닌 문자가 있다: ${JSON.stringify(char)}`,
      );
    }

    // 2**shift로 누적한다. `<<`는 32비트 연산이라 shift가 32 이상인
    // continuation 7개 이상짜리 필드에서 랩어라운드돼, 거대한 델타가 작고
    // 그럴듯한 값으로 둔갑한다 — sources 범위 안에 우연히 들면 확정적 오답을
    // 조용히 낸다. 곱셈은 Number.MAX_SAFE_INTEGER까지 정확하므로 그런 델타는
    // 아래에서 있는 그대로 계산되고, 이후 sources 범위 검사가 걸러낸다.
    value += (digit & DATA_MASK) * 2 ** shift;

    if ((digit & CONTINUATION_BIT) !== 0) {
      shift += 5;
      continue;
    }

    // `&`/`>>>`도 32비트 연산이므로 큰 값에는 쓰지 않는다.
    const negative = value % 2 === 1;
    const magnitude = (value - (negative ? 1 : 0)) / 2;

    fields.push(negative ? -magnitude : magnitude);
    shift = 0;
    value = 0;
  }

  if (shift !== 0) {
    throw new Error("소스맵 mappings에 미종결 base64 VLQ 값이 있다.");
  }

  return fields;
}

/** 절대경로나 URL인지 본다. 이미 패키지 기준 좌표계가 아니므로 합성하지 않는다. */
function isAlreadyResolved(source) {
  return source.startsWith("/") || source.includes("://");
}

/**
 * sources 항목 하나를 mapDir(맵 파일 위치, 패키지 기준 상대경로) 기준으로 합성해
 * finding.file과 같은 기준점의 패키지 상대 경로로 만든다.
 *
 * @param {string} source sources 배열의 원소, 맵 파일 위치 기준 상대경로
 * @param {string | undefined} sourceRoot 맵의 sourceRoot 필드, 있으면 source 앞에 붙는다
 * @param {string} mapDir 맵 파일이 있는 디렉터리의 패키지 기준 상대 POSIX 경로
 * @returns {string}
 */
function resolveSourcePath(source, sourceRoot, mapDir) {
  const withRoot = sourceRoot ? `${sourceRoot}/${source}` : source;

  if (isAlreadyResolved(withRoot)) {
    return withRoot;
  }

  return path.posix.normalize(path.posix.join(mapDir, withRoot));
}

/**
 * 소스맵 v3 계약을 검사한다. 위반이면 무엇이 잘못됐는지 담아 던진다.
 *
 * 폴백하지 않는다 — compat-bcd.mjs, baseline.mjs와 같은 규약이다. 계약을 벗어난
 * 맵을 억지로 읽으면 원본 파일을 조용히 날조하게 된다.
 *
 * @param {unknown} map JSON.parse 결과
 */
function assertValidSourceMap(map) {
  if (map === null || typeof map !== "object") {
    throw new Error("소스맵이 JSON 객체가 아니다.");
  }

  if (map.version !== 3) {
    throw new Error(
      `소스맵 version이 3이 아니다: ${JSON.stringify(map.version)}`,
    );
  }

  if (typeof map.mappings !== "string") {
    throw new Error("소스맵에 mappings 문자열 필드가 없다.");
  }

  if (!Array.isArray(map.sources)) {
    throw new Error("소스맵에 sources 배열 필드가 없다.");
  }

  const invalidIndex = map.sources.findIndex(
    (source) => typeof source !== "string",
  );

  if (invalidIndex !== -1) {
    // resolveSourcePath는 각 항목에 문자열 메서드(startsWith)를 바로 쓴다.
    // 여기서 막지 않으면 이 module의 다른 모든 계약 위반과 달리 원시
    // TypeError가 새어나가 "무엇이 계약을 어겼는지"를 말하지 못한다.
    throw new Error(
      `소스맵 sources 배열의 ${invalidIndex}번째 항목이 문자열이 아니다: ` +
        `${JSON.stringify(map.sources[invalidIndex])}.`,
    );
  }
}

/**
 * mapText(소스맵 v3 JSON 문자열)에서 생성 코드 줄 번호로 원본 소스 파일 경로를
 * 찾는 조회기를 만든다.
 *
 * @param {string} mapText 소스맵 v3 JSON 문자열. 파일을 읽지 않는다 — 호출부가
 *   읽어서 넘긴다.
 * @param {{ mapDir: string }} options mapDir: 맵 파일이 있는 디렉터리의 패키지
 *   기준 상대 POSIX 경로. 예: "dist"
 * @returns {{ originOf: (line: number) => string | null }}
 */
export function createOriginLookup(mapText, { mapDir }) {
  let map;

  try {
    map = JSON.parse(mapText);
  } catch (cause) {
    throw new Error("소스맵 JSON을 파싱할 수 없다.", { cause });
  }

  assertValidSourceMap(map);

  const sourcePaths = map.sources.map((source) =>
    resolveSourcePath(source, map.sourceRoot, mapDir),
  );

  // 생성 줄(1부터) → 원본 파일 경로. 세그먼트가 있는 줄만 채워진다.
  const lineToPath = new Map();

  const lines = map.mappings.split(";");

  // sources 인덱스는 맵 전체에 걸친 누적 델타다 — 줄이 바뀌어도 초기화되지 않는다.
  // 생성컬럼(fields[0])은 줄마다 0으로 되돌아가지만 여기서는 쓰지 않는다.
  let sourcesIndex = 0;

  for (let lineOffset = 0; lineOffset < lines.length; lineOffset += 1) {
    const line = lines[lineOffset];

    if (line === "") {
      continue;
    }

    let resolvedForLine = null;

    for (const segment of line.split(",")) {
      if (segment === "") {
        continue;
      }

      const fields = decodeVlqFields(segment);

      if (![1, 4, 5].includes(fields.length)) {
        throw new Error(
          `소스맵 mappings 세그먼트의 필드 수가 잘못됐다: ${fields.length}개 ` +
            "(허용: 1개, 4개, 5개).",
        );
      }

      // 필드 1개(생성컬럼만)는 원본이 없는 구간이다. sources 인덱스는 그대로 둔다.
      if (fields.length === 1) {
        continue;
      }

      sourcesIndex += fields[1];

      // 범위 초과는 "이 줄에 원본이 없다"가 아니라 맵 자체가 깨졌다는 신호다.
      // null로 흡수하면 위쪽 후퇴가 이전 줄의 — 전혀 무관할 수 있는 — 경로를
      // 이 줄에 붙이게 된다. 그건 "모른다"(null)가 아니라 "틀린 답을 안다"이므로
      // 폴백하지 않는다 — compat-bcd.mjs:30-33, baseline.mjs:28과 같은 규약이다.
      // originOf 호출 시점이 아니라 여기, mappings를 훑는 파싱 시점에 던져야
      // 일부 줄만 조회하는 소비자도 깨진 맵을 놓치지 않는다.
      if (sourcesIndex < 0 || sourcesIndex >= sourcePaths.length) {
        throw new Error(
          `소스맵 mappings의 sources 인덱스가 범위를 벗어난다: ${sourcesIndex} ` +
            `(sources 길이 ${sourcePaths.length}, 생성 줄 ${lineOffset + 1}).`,
        );
      }

      // 그 줄의 원본 파일은 원본 인덱스를 가진 첫 세그먼트로 정한다.
      // 이후 세그먼트도 델타 추적을 위해 계속 풀지만 파일 판정에는 쓰지 않는다.
      if (resolvedForLine === null) {
        resolvedForLine = sourcePaths[sourcesIndex];
      }
    }

    if (resolvedForLine !== null) {
      lineToPath.set(lineOffset + 1, resolvedForLine);
    }
  }

  return {
    originOf(line) {
      // 그 줄에 값이 없으면 위쪽으로 후퇴해 가장 가까운 앞선 줄의 값을 쓴다.
      // 세그먼트 없는 줄(예: 빈 줄, 순수 공백 줄)이 실제로 흔하기 때문이다.
      for (let candidate = line; candidate >= 1; candidate -= 1) {
        const found = lineToPath.get(candidate);

        if (found !== undefined) {
          return found;
        }
      }

      return null;
    },
  };
}
