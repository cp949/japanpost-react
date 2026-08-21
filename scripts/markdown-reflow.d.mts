/**
 * 문자열이 터미널·에디터에서 차지하는 표시 폭을 센다.
 * 한글·한자·가나와 전각 기호는 2, 나머지는 1로 센다.
 */
export function displayWidth(text: string): number;

/**
 * 내용을 낱말로 자른다. 감싸기의 최소 단위다.
 * 인라인 코드 스팬은 안에 공백이 있어도 한 낱말로 둔다.
 */
export function splitWords(content: string): string[];

/**
 * 치환으로 내용이 바뀐 마크다운 블록만 maxWidth 표시 폭으로 다시 감싼다.
 *
 * 코드 펜스, 표, 제목, 인용, HTML은 건드리지 않는다.
 * 인라인 코드 스팬 안에서는 줄을 나누지 않는다.
 * original과 rewritten의 줄 수가 다르면 던진다.
 *
 * @param maxWidth 기본값 80
 */
export function reflowChangedBlocks(
  original: string,
  rewritten: string,
  maxWidth?: number,
): string;
