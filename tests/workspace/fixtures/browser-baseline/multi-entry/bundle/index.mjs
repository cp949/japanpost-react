// multi-entry 픽스처의 루트(".") 엔트리. resolveDistEntries가 exports 최상위
// 서브경로도 잡는지 보려고 고유한 위반(structuredClone)을 하나 심어 둔다.
export function clone(value) {
  return structuredClone(value);
}
