/** 두 출력이 갈라지는 첫 지점이다. 판정이 아니라 진단용 근사치다. */
export interface SyntaxDivergence {
  /**
   * 1부터 세는 줄 번호다.
   * 0은 불일치는 실재하지만 위치를 특정하지 못했다는 뜻이다.
   */
  line: number;
  /** esnext 재출력 쪽 줄 원문이다. */
  actual: string;
  /** 계약 타깃 재출력 쪽 줄 원문이다. 하향된 구문이 여기 보인다. */
  lowered: string;
}

/**
 * 같은 소스를 esnext와 계약 타깃으로 각각 재출력해 비교한다.
 *
 * 두 출력이 같으면 null이다 — 계약 타깃을 초과하는 문법이 없다는 뜻이다.
 * 다르면 진단용으로 불일치 지점 하나를 돌려준다. 하향이 끼워 넣는 호이스트
 * 줄 때문에 actual과 lowered가 같은 문장의 before/after라는 보장은 없다.
 *
 * syntaxTarget이 비었으면 던진다. 기준을 스스로 지어내지 않는다.
 *
 * @param syntaxTarget 계약에서 파생한 esbuild 타깃
 */
export function findFirstSyntaxDivergence(
  source: string,
  syntaxTarget: string | string[],
): Promise<SyntaxDivergence | null>;
