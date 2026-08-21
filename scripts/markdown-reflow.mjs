/**
 * 토큰 치환으로 줄 폭이 어긋난 마크다운 블록을 다시 감싼다.
 *
 * 문서 원본은 `{{MIN_CHROME}}` 같은 토큰 너비에 맞춰 손으로 감싸여 있다.
 * 치환값은 그보다 짧으므로(`80`) 생성물의 줄이 들쭉날쭉해진다.
 * 원본을 치환값에 맞춰 다시 감싸면 기준선이 바뀔 때마다 손으로 다시 감싸야 하고,
 * 그러면 "기준선 상향 = package.json 한 줄 변경"이라는 성질이 깨진다.
 * 그래서 감싸기를 파생으로 만든다.
 *
 * 손대는 범위는 치환으로 실제 내용이 바뀐 블록뿐이다.
 * 나머지 줄은 원문 그대로 통과시킨다.
 */

/** 목록 표지와 그 뒤 공백이다. 예: "- ", "1. " */
const LIST_MARKER = /^(\s*)(?:[-*+]|\d+\.)\s+/;

/** 코드 펜스다. 안쪽은 감싸지 않는다. */
const FENCE = /^\s*(?:```|~~~)/;

/** 감싸면 뜻이 달라지는 줄의 시작 문자다. 제목, 표, 인용, HTML. */
const NON_PROSE_START = /^[#|>]|^<!?/;

/**
 * 표시 폭이 2인 문자 범위다.
 * 한글·한자·가나와 전각 기호가 여기 든다. 한국어 문서가 이 폭 기준으로 감싸여 있다.
 */
const WIDE_CHARACTER =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︐-︙︰-﹯＀-｠￠-￦]/;

/**
 * 터미널·에디터에서 차지하는 표시 폭을 센다.
 *
 * 글자 수가 아니라 표시 폭이어야 한다. 한국어 문서를 글자 수로 감싸면
 * 실제 폭이 두 배가 되어 영어 문서와 기준이 어긋난다.
 *
 * @param {string} text
 * @returns {number}
 */
export function displayWidth(text) {
  let width = 0;

  for (const character of text) {
    width += WIDE_CHARACTER.test(character) ? 2 : 1;
  }

  return width;
}

/**
 * 내용을 낱말로 자른다.
 *
 * 감싸기의 최소 단위다. 생성물이 제대로 채워졌는지 검사할 때도 같은 기준이 필요해
 * 내보낸다.
 *
 * 인라인 코드 스팬은 안에 공백이 있어도(`chrome >= 80`) 한 낱말로 둔다.
 * 스팬 가운데서 줄을 나누면 원문을 읽기 어려워진다.
 *
 * @param {string} content
 * @returns {string[]}
 */
export function splitWords(content) {
  const words = [];
  let current = "";
  let index = 0;

  while (index < content.length) {
    const character = content[index];

    if (character === "`") {
      const close = content.indexOf("`", index + 1);

      if (close !== -1) {
        current += content.slice(index, close + 1);
        index = close + 1;
        continue;
      }
    }

    if (character === " " || character === "\t") {
      if (current !== "") {
        words.push(current);
        current = "";
      }

      index += 1;
      continue;
    }

    current += character;
    index += 1;
  }

  if (current !== "") {
    words.push(current);
  }

  return words;
}

/** 블록 하나를 maxWidth 표시 폭으로 다시 감싼다. */
function reflowBlock(blockLines, maxWidth) {
  const first = blockLines[0];
  const markerMatch = LIST_MARKER.exec(first);
  const prefix = markerMatch === null ? /^\s*/.exec(first)[0] : markerMatch[0];
  // 이어지는 줄은 표지 너비만큼 들여쓴다.
  const indent = " ".repeat(displayWidth(prefix));

  const content = [
    first.slice(prefix.length),
    ...blockLines.slice(1).map((line) => line.trimStart()),
  ]
    .join(" ")
    .trim();

  const lines = [];
  let current = prefix;
  let empty = true;

  for (const word of splitWords(content)) {
    const candidate = empty ? `${current}${word}` : `${current} ${word}`;

    // 낱말 하나가 한계보다 길면 나눌 수 없다. 그 줄만 한계를 넘긴다.
    if (!empty && displayWidth(candidate) > maxWidth) {
      lines.push(current);
      current = `${indent}${word}`;
    } else {
      current = candidate;
    }

    empty = false;
  }

  lines.push(current);

  return lines;
}

/** 블록을 시작할 수 있는 줄인지 본다. */
function startsBlock(line) {
  const trimmed = line.trim();

  if (trimmed === "") {
    return false;
  }

  // 공백 4칸 이상은 들여쓰기 코드 블록이다.
  if (/^ {4,}/.test(line) && LIST_MARKER.exec(line) === null) {
    return false;
  }

  return !NON_PROSE_START.test(trimmed);
}

/** 앞 줄에서 이어지는 줄인지 본다. */
function continuesBlock(line) {
  const trimmed = line.trim();

  if (trimmed === "" || FENCE.test(line) || LIST_MARKER.exec(line) !== null) {
    return false;
  }

  return !NON_PROSE_START.test(trimmed);
}

/**
 * 치환으로 내용이 바뀐 블록만 maxWidth 표시 폭으로 다시 감싼다.
 *
 * original과 rewritten은 줄 수가 같아야 한다.
 * 토큰 치환은 줄을 늘리거나 줄이지 않으므로 이 조건이 깨졌다면 짝짓기가 틀린 것이고,
 * 그대로 진행하면 엉뚱한 블록을 감싸게 된다.
 *
 * @param {string} original 치환 전 원문
 * @param {string} rewritten 치환 후 결과
 * @param {number} [maxWidth] 표시 폭 한계
 * @returns {string} 바뀐 블록만 다시 감싼 결과
 */
export function reflowChangedBlocks(original, rewritten, maxWidth = 80) {
  const originalLines = original.split("\n");
  const lines = rewritten.split("\n");

  if (originalLines.length !== lines.length) {
    throw new Error(
      `원본과 치환 결과의 줄 수가 다르다(${originalLines.length} vs ${lines.length}). 블록을 짝지을 수 없다.`,
    );
  }

  const out = [];
  let index = 0;
  let inFence = false;

  while (index < lines.length) {
    const line = lines[index];

    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      index += 1;
      continue;
    }

    if (inFence || !startsBlock(line)) {
      out.push(line);
      index += 1;
      continue;
    }

    let end = index + 1;

    while (end < lines.length && continuesBlock(lines[end])) {
      end += 1;
    }

    const before = originalLines.slice(index, end).join("\n");
    const after = lines.slice(index, end).join("\n");

    if (before === after) {
      out.push(...lines.slice(index, end));
    } else {
      out.push(...reflowBlock(lines.slice(index, end), maxWidth));
    }

    index = end;
  }

  return out.join("\n");
}
