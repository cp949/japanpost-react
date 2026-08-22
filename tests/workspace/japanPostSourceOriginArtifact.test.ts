import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * japanpost-react의 실제 client 산출물과 소스맵이 함께 이동했는지 검증한다.
 *
 * postbuild가 use client 지시문을 앞에 붙일 때 맵의 생성 줄도 같은 수만큼
 * 밀어야 한다. 여기서는 생산 postbuild의 구현을 가져오지 않고, 독립적인
 * 줄 수 계산과 자연 대조군(index 맵)으로 그 산출물 계약을 확인한다.
 */
const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../packages/japanpost-react",
);
const useClientDirective = '"use client";\n';
const BASE64_VLQ_SEGMENT_AT_START = /^[A-Za-z0-9+/]+(?=[,;]|$)/;

/** 실제 패키지 산출물을 읽되, 빌드 누락을 조용히 통과시키지 않는다. */
function readRequiredDistFile(relativePath: string): string {
  const filePath = path.join(packageDir, "dist", relativePath);

  try {
    return readFileSync(filePath, "utf8");
  } catch (cause) {
    throw new Error(
      `japanpost-react dist 산출물을 읽을 수 없다: ${filePath}. 먼저 pnpm --filter @cp949/japanpost-react build를 실행한다.`,
      { cause },
    );
  }
}

/** mappings 맨 앞의 빈 생성 줄 수를 센다. */
function countLeadingGeneratedEmptyLines(mappings: string): number {
  return mappings.match(/^;*/)?.[0].length ?? 0;
}

/** 지시문 문자열 자체에서 생성 줄 보정량을 독립적으로 구한다. */
function countLines(text: string): number {
  return text.split("\n").length - 1;
}

describe("japanpost-react 산출물 source-origin 보정", () => {
  it("use client 지시문만큼 client 맵의 생성 줄을 보정한다", () => {
    const clientSource = readRequiredDistFile("client.es.js");
    const clientMap = JSON.parse(readRequiredDistFile("client.es.js.map"));
    const indexMap = JSON.parse(readRequiredDistFile("index.es.js.map"));

    // 지시문이 누락되거나 다른 텍스트가 파일 앞에 오면 client 소비자 계약이 깨진다.
    expect(clientSource).toMatch(/^"use client";\r?\n/);

    const clientLeadingEmptyLines = countLeadingGeneratedEmptyLines(
      clientMap.mappings,
    );
    const indexLeadingEmptyLines = countLeadingGeneratedEmptyLines(
      indexMap.mappings,
    );
    const useClientDirectiveLineCount = countLines(useClientDirective);

    // client mappings가 ";"뿐이면 선행 빈 생성 줄만 세고 실제 매핑 없이 통과한다.
    expect(clientMap.mappings.slice(clientLeadingEmptyLines)).toMatch(
      BASE64_VLQ_SEGMENT_AT_START,
    );
    // index mappings가 ""이면 client와의 상대 보정량만 맞아 거짓 GREEN이 된다.
    expect(indexMap.mappings.slice(indexLeadingEmptyLines)).toMatch(
      BASE64_VLQ_SEGMENT_AT_START,
    );

    // 맵만 덜/더 밀거나 JS 지시문과 맵 보정량을 다르게 적용한 구현을 걸러낸다.
    expect(clientLeadingEmptyLines).toBe(
      indexLeadingEmptyLines + useClientDirectiveLineCount,
    );

    const firstClientMappedLine =
      clientSource.split(/\r?\n/)[clientLeadingEmptyLines];

    // 과도한 음수 보정으로 빈 줄을 첫 매핑 줄로 삼는 구현을 걸러낸다.
    expect(firstClientMappedLine).toMatch(/\S/);
    // -1 보정으로 모듈 경로 주석을 첫 매핑 줄로 삼는 구현을 걸러낸다.
    expect(firstClientMappedLine.trim()).not.toMatch(/^(?:\/\/|\/\*)/);
  });
});
