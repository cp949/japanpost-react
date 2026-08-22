// multi-entry 픽스처의 "./feature-b" import 조건. 같은 서브경로의 require 조건
// (feature-b.cjs)과 서로 다른 위반(Object.hasOwn)을 심어 조건 map의 각 갈래가
// 따로 잡히는지 구분해서 증명한다.
export function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}
