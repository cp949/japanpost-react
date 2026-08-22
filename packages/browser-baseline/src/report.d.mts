import type { BaselineCheckResult } from "./check.mjs";

/**
 * 검사 결과를 사람이 읽을 줄 목록으로 만든다.
 *
 * 순수 함수다. 읽지도 찍지도 종료하지도 않는다.
 * 어느 스트림에 찍을지와 종료 코드는 호출부가 ok를 보고 정한다.
 *
 * 반환 원소 하나가 출력 한 줄이며 줄바꿈은 들어 있지 않다.
 * 빈 문자열은 빈 줄이다.
 *
 * @param result checkPackageBaseline의 반환값을 그대로 넘길 수 있다
 */
export function formatReport(
  result: Pick<BaselineCheckResult, "baseline" | "findings" | "ok">,
): string[];
