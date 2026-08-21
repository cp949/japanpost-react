import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  displayWidth,
  reflowChangedBlocks,
  splitWords,
} from "../../scripts/markdown-reflow.mjs";

const docsDir = path.resolve(
  import.meta.dirname,
  "../../packages/japanpost-react/docs",
);

/** 문서에서 "## ..." 제목 하나가 덮는 구간을 잘라 낸다. */
function sectionOf(source: string, heading: string): string[] {
  const lines = source.split("\n");
  const start = lines.indexOf(heading);
  const end = lines.findIndex(
    (line, index) => index > start && line.startsWith("## "),
  );

  expect(start).toBeGreaterThanOrEqual(0);

  return lines.slice(start, end === -1 ? lines.length : end);
}

/** 표시 폭 기준으로 모든 줄이 한계 안인지 본다. */
function widths(text: string): number[] {
  return text.split("\n").map((line) => displayWidth(line));
}

/** 절 안의 목록 항목을 블록 단위로 자른다. */
function listBlocks(section: string[]): string[][] {
  const blocks: string[][] = [];

  for (const line of section) {
    if (/^-\s/.test(line)) {
      blocks.push([line]);
      continue;
    }

    if (/^\s{2,}\S/.test(line) && blocks.length > 0) {
      blocks[blocks.length - 1].push(line);
    }
  }

  return blocks;
}

/**
 * 다음 줄의 첫 낱말을 더 받을 수 있는데도 넘긴 줄을 모은다.
 * 비어 있지 않으면 감싸기가 덜 채워졌다는 뜻이다.
 */
function underfilledLines(section: string[], maxWidth = 80): string[] {
  const loose: string[] = [];

  for (let index = 0; index < section.length - 1; index += 1) {
    const line = section[index];
    const next = section[index + 1];

    // 같은 블록에서 이어지는 줄일 때만 본다.
    if (line.trim() === "" || !/^\s{2,}\S/.test(next)) {
      continue;
    }

    const [firstWord] = splitWords(next.trim());

    if (displayWidth(line) + 1 + displayWidth(firstWord) <= maxWidth) {
      loose.push(line);
    }
  }

  return loose;
}

describe("displayWidth", () => {
  it("ASCII는 글자 수와 같다", () => {
    expect(displayWidth("chrome80")).toBe(8);
  });

  it("한글은 글자당 2로 센다", () => {
    expect(displayWidth("검증")).toBe(4);
    expect(displayWidth("- 검증 기준선")).toBe(13);
  });
});

describe("reflowChangedBlocks", () => {
  it("치환으로 짧아진 목록 항목을 다시 채운다", () => {
    const original = [
      "- `dist/*.es.js` ships syntax that Chrome {{MIN_CHROME}} parses. Every build",
      "  verifies this.",
    ].join("\n");
    const rewritten = [
      "- `dist/*.es.js` ships syntax that Chrome 80 parses. Every build",
      "  verifies this.",
    ].join("\n");

    expect(reflowChangedBlocks(original, rewritten)).toBe(
      "- `dist/*.es.js` ships syntax that Chrome 80 parses. Every build verifies this.",
    );
  });

  it("치환이 없는 블록은 줄바꿈을 그대로 둔다", () => {
    const source = [
      "- This package emits no CSS.",
      "- Contemporary browsers such as Safari 13.1 and Firefox 74 can parse the",
      "  output.",
    ].join("\n");

    expect(reflowChangedBlocks(source, source)).toBe(source);
  });

  it("인라인 코드 스팬 안에서는 줄을 나누지 않는다", () => {
    const original = "- aaaa `{{BROWSERSLIST_QUERY}}` bbbb";
    const rewritten = "- aaaa `chrome >= 80` bbbb";

    expect(reflowChangedBlocks(original, rewritten, 20)).toBe(
      ["- aaaa", "  `chrome >= 80`", "  bbbb"].join("\n"),
    );
  });

  it("한글은 표시 폭으로 계산해 한계를 넘기지 않는다", () => {
    const original =
      "- 검증 대상은 Chrome {{MIN_CHROME}}뿐입니다. 나머지는 범위 밖입니다.";
    const rewritten = "- 검증 대상은 Chrome 80뿐입니다. 나머지는 범위 밖입니다.";

    const result = reflowChangedBlocks(original, rewritten, 30);

    expect(Math.max(...widths(result))).toBeLessThanOrEqual(30);
    expect(result.split("\n").length).toBeGreaterThan(1);
    // 낱말과 순서는 그대로여야 한다.
    expect(result.replace(/\n\s+/g, " ")).toBe(rewritten);
  });

  it("이어지는 줄의 들여쓰기는 목록 표지 너비를 따른다", () => {
    const original = "- aaa {{MIN_CHROME}} bbb ccc";
    const rewritten = "- aaa 80 bbb ccc";

    expect(reflowChangedBlocks(original, rewritten, 10)).toBe(
      ["- aaa 80", "  bbb ccc"].join("\n"),
    );
  });

  it("코드 블록 안은 건드리지 않는다", () => {
    const original = ["```js", "const target = {{MIN_CHROME}};", "```"].join(
      "\n",
    );
    const rewritten = ["```js", "const target = 80;", "```"].join("\n");

    expect(reflowChangedBlocks(original, rewritten, 10)).toBe(rewritten);
  });

  it("표는 건드리지 않는다", () => {
    const original = "| 기준 | {{MIN_CHROME}} |";
    const rewritten = "| 기준 | 80 |";

    expect(reflowChangedBlocks(original, rewritten, 5)).toBe(rewritten);
  });

  it("제목은 건드리지 않는다", () => {
    const original = "## Chrome {{MIN_CHROME}} 지원";
    const rewritten = "## Chrome 80 지원";

    expect(reflowChangedBlocks(original, rewritten, 5)).toBe(rewritten);
  });

  it("줄 수가 다르면 던진다", () => {
    expect(() => reflowChangedBlocks("a\nb", "a")).toThrow(/줄 수가 다르다/);
  });
});

describe("패키지 README 생성", () => {
  const cases = [
    { file: "README.en.md", heading: "## Browser Support" },
    { file: "README.ko.md", heading: "## 브라우저 지원" },
  ];

  // 치환값은 토큰보다 항상 짧다. 그래서 문제는 폭 초과가 아니라 덜 채워진 줄이다.
  const baselines = [
    { minChrome: "80", query: "chrome >= 80" },
    { minChrome: "120", query: "chrome >= 120" },
    { minChrome: "9", query: "chrome >= 9" },
  ];

  function substitute(text: string, minChrome: string, query: string) {
    return text
      .replaceAll("{{MIN_CHROME}}", minChrome)
      .replaceAll("{{BROWSERSLIST_QUERY}}", query);
  }

  /** 문서에서 토큰이 든 목록 블록만 골라 낸다. 재래핑 대상은 이것뿐이다. */
  function tokenBlocks(file: string, heading: string): string[] {
    const source = fs.readFileSync(path.join(docsDir, file), "utf8").trim();

    return listBlocks(sectionOf(source, heading))
      .map((block) => block.join("\n"))
      .filter((block) => block.includes("{{"));
  }

  for (const { file, heading } of cases) {
    it(`${file}의 브라우저 지원 절에 토큰이 든 항목이 있다`, () => {
      expect(tokenBlocks(file, heading).length).toBeGreaterThan(0);
    });

    it(`${file}은 치환만으로는 줄이 덜 채워진다`, () => {
      const loose = tokenBlocks(file, heading).filter(
        (block) =>
          underfilledLines(substitute(block, "80", "chrome >= 80").split("\n"))
            .length > 0,
      );

      // 다시 감싸는 단계가 필요한 이유다. 이 단언이 깨지면 원본이 이미 치환값
      // 기준으로 감싸여 있다는 뜻이므로 파생을 다시 따져야 한다.
      expect(loose.length).toBeGreaterThan(0);
    });

    for (const { minChrome, query } of baselines) {
      it(`${file}의 토큰 항목은 Chrome ${minChrome} 기준에서도 고르게 감싸인다`, () => {
        for (const block of tokenBlocks(file, heading)) {
          const reflowed = reflowChangedBlocks(
            block,
            substitute(block, minChrome, query),
          ).split("\n");

          expect(Math.max(...reflowed.map(displayWidth))).toBeLessThanOrEqual(
            80,
          );
          expect(underfilledLines(reflowed)).toEqual([]);
        }
      });
    }
  }

  it("미치환 토큰이 생성물에 남지 않는다", () => {
    for (const { file } of cases) {
      const original = fs.readFileSync(path.join(docsDir, file), "utf8").trim();
      const rewritten = substitute(original, "80", "chrome >= 80");

      expect(reflowChangedBlocks(original, rewritten)).not.toContain("{{");
    }
  });
});
