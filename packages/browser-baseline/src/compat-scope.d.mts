/**
 * acorn AST를 훑어 전역으로 해석되는 Identifier 노드를 모은다.
 *
 * 지역 선언·매개변수·import 바인딩에 가려진 이름은 결과에 들어가지 않는다.
 * 반환된 Set은 노드 참조 동일성으로 조회한다.
 *
 * @param ast acorn이 만든 Program 노드
 */
export function collectGlobalReferences(ast: object): Set<object>;
