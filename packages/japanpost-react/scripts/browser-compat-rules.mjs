/**
 * 런타임 API 목록과 dist 스캐너다.
 *
 * 문법 검사는 syntax-gate.mjs가 담당한다.
 * 이 모듈은 esbuild가 다운레벨할 수 없는 런타임 API만 다룬다.
 * 각 항목의 chrome 값은 그 API가 처음 지원된 Chrome 버전이며,
 * createScanner가 계약의 Chrome 하한과 비교해 검사 대상을 정한다.
 */
export const FORBIDDEN_APIS = [
  { pattern: /\bstructuredClone\s*\(/, name: "structuredClone", chrome: 98 },
  { pattern: /\breportError\s*\(/, name: "reportError", chrome: 95 },
  { pattern: /\bAggregateError\b/, name: "AggregateError", chrome: 85 },
  { pattern: /\bWeakRef\b/, name: "WeakRef", chrome: 84 },
  {
    pattern: /\bFinalizationRegistry\b/,
    name: "FinalizationRegistry",
    chrome: 84,
  },
  { pattern: /\bObject\.hasOwn\s*\(/, name: "Object.hasOwn", chrome: 93 },
  { pattern: /\bObject\.groupBy\s*\(/, name: "Object.groupBy", chrome: 117 },
  { pattern: /\bMap\.groupBy\s*\(/, name: "Map.groupBy", chrome: 117 },
  { pattern: /\bPromise\.any\s*\(/, name: "Promise.any", chrome: 85 },
  { pattern: /\bArray\.fromAsync\s*\(/, name: "Array.fromAsync", chrome: 121 },
  { pattern: /\bAbortSignal\.abort\s*\(/, name: "AbortSignal.abort", chrome: 93 },
  {
    pattern: /\bAbortSignal\.timeout\s*\(/,
    name: "AbortSignal.timeout",
    chrome: 103,
  },
  { pattern: /\bAbortSignal\.any\s*\(/, name: "AbortSignal.any", chrome: 116 },
  { pattern: /\bsignal\s*\.\s*reason\b/, name: "AbortSignal.reason", chrome: 98 },
  { pattern: /\bURL\.canParse\s*\(/, name: "URL.canParse", chrome: 120 },
  { pattern: /\bResponse\.json\s*\(/, name: "Response.json()", chrome: 93 },
  { pattern: /\bcrypto\.randomUUID\s*\(/, name: "crypto.randomUUID", chrome: 92 },
  { pattern: /\bIntl\.DisplayNames\b/, name: "Intl.DisplayNames", chrome: 81 },
  { pattern: /\bIntl\.Segmenter\b/, name: "Intl.Segmenter", chrome: 87 },
  { pattern: /\.replaceAll\s*\(/, name: ".replaceAll()", chrome: 85 },
  { pattern: /\.at\s*\(/, name: ".at()", chrome: 92 },
  { pattern: /\.findLast\s*\(/, name: ".findLast()", chrome: 97 },
  { pattern: /\.findLastIndex\s*\(/, name: ".findLastIndex()", chrome: 97 },
  { pattern: /\.toSorted\s*\(/, name: ".toSorted()", chrome: 110 },
  { pattern: /\.toReversed\s*\(/, name: ".toReversed()", chrome: 110 },
  { pattern: /\.toSpliced\s*\(/, name: ".toSpliced()", chrome: 110 },
  { pattern: /\.with\s*\(/, name: ".with()", chrome: 110 },
  { pattern: /\.replaceChildren\s*\(/, name: ".replaceChildren()", chrome: 86 },
  { pattern: /\.throwIfAborted\s*\(/, name: ".throwIfAborted()", chrome: 100 },
  { pattern: /\.showPicker\s*\(/, name: ".showPicker()", chrome: 99 },
  {
    pattern: /addEventListener\s*\(.*\bsignal\s*[:,}]/,
    name: "addEventListener({ signal })",
    chrome: 90,
  },
];

/**
 * 오탐 예외 목록이다.
 * dist는 생성물이라 인라인 주석을 넣을 수 없으므로 여기서 관리한다.
 * 항목을 추가할 때는 reason에 왜 안전한지를 남긴다.
 */
export const ALLOWED = [];

/**
 * 계약의 Chrome 하한에 맞춰 스캐너를 만든다.
 *
 * 하한 이하에서 이미 지원되는 항목은 이 시점에 목록에서 빠진다.
 * 기준선을 올리면 목록을 손으로 편집하지 않아도 검사 대상이 줄어든다.
 *
 * @param {{ minChrome: number, allowed?: Array<{ file: string, name: string, reason?: string }> }} options
 */
export function createScanner({ minChrome, allowed = ALLOWED }) {
  if (!Number.isInteger(minChrome)) {
    throw new Error(
      `minChrome은 정수여야 한다. 받은 값: ${JSON.stringify(minChrome)}`,
    );
  }

  const rules = FORBIDDEN_APIS.filter((rule) => rule.chrome > minChrome);

  return {
    minChrome,
    rules,

    /**
     * source를 줄 단위로 훑어 데니리스트 위반을 모은다.
     * 정규식은 전역 플래그를 쓰지 않으므로 lastIndex 상태가 남지 않는다.
     */
    scan(source, fileName = "") {
      const lines = source.split("\n");
      const violations = [];

      for (const rule of rules) {
        const isAllowed = allowed.some(
          (entry) =>
            entry.name === rule.name &&
            (entry.file === fileName || entry.file === "*"),
        );

        if (isAllowed) {
          continue;
        }

        lines.forEach((text, index) => {
          if (!rule.pattern.test(text)) {
            return;
          }

          violations.push({
            file: fileName,
            line: index + 1,
            name: rule.name,
            chrome: rule.chrome,
            text: text.trim(),
          });
        });
      }

      violations.sort(
        (left, right) =>
          left.line - right.line || left.name.localeCompare(right.name),
      );

      return violations;
    },
  };
}
