/** 소스맵 기반 줄 → 원본 파일 조회기다. */
export interface OriginLookup {
  /**
   * 1부터 세는 생성 코드 줄 번호로 원본 소스 파일 경로를 찾는다.
   * 그 줄에 매핑이 없으면 위쪽으로 후퇴해 가장 가까운 앞선 줄의 값을 쓴다.
   * 앞에 아무 매핑도 없으면 null이다.
   */
  originOf(line: number): string | null;
}

/**
 * mapText(소스맵 v3 JSON 문자열)에서 조회기를 만든다.
 *
 * JSON 파싱에 실패하거나, version이 3이 아니거나, mappings가 문자열이 아니거나,
 * sources가 배열이 아니거나, sources 항목 중 문자열이 아닌 것이 있으면 던진다.
 * mappings의 세그먼트가 가리키는 sources 인덱스가
 * sources 배열 범위를 벗어나도(맵이 깨졌다는 신호이므로) 파싱 시점에 던진다 —
 * originOf 호출 때가 아니라 이 함수를 호출하는 즉시다. fs에 접근하지 않는다 —
 * 맵을 읽는 것은 호출부 책임이다.
 *
 * @param mapText 소스맵 v3 JSON 문자열
 * @param options.mapDir 맵 파일이 있는 디렉터리의 패키지 기준 상대 POSIX 경로.
 *   예: "dist". sources 항목(맵 파일 위치 기준 상대경로)과 합성해
 *   finding.file과 같은 기준점의 경로를 만든다.
 */
export function createOriginLookup(
  mapText: string,
  options: { mapDir: string },
): OriginLookup;
