// with-sourcemap 픽스처: 이 번들과 .map은 tsup 같은 실제 빌드 도구가 아니라
// 손으로 쓴 것이다. check.mjs가 형제 .map 파일을 찾아 API 위반에 원인 파일을
// 붙이는 경로가 특정 빌드 도구에 종속되지 않음을 증명하는 것이 이 픽스처의
// 존재 이유다.
//
// 위반 3건을 심어 origin 판정의 세 가지 분기를 모두 낸다.
//   - last()의 .at() (tier 2): 맵에 이 줄의 세그먼트가 없다. origin은 null,
//     originNote도 null(맵 자체는 쓸 수 있다)이어야 한다 — "맵은 있지만 이
//     줄만 안 매핑됨"을 나타낸다.
//   - hasKey()의 Object.hasOwn (tier 1): 맵의 sources[1](src/hasKey.ts)에
//     매핑된다. "항상 sources[0]을 돌려주는" 잘못된 구현이면 이 위반의
//     origin이 틀리게 나온다.
//   - clone()의 structuredClone (tier 1): 맵의 sources[0](src/clone.ts)에
//     매핑된다. 앞선 위반과 origin이 실제로 갈린다는 것을 보인다.

export function last(items) {
  return items.at(-1);
}

export function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}

export function clone(value) {
  return structuredClone(value);
}
