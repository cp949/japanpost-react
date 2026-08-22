// no-sourcemap-pair 픽스처: 형제 .map 파일이 아예 없는 상태에서 위반이
// 2건 이상일 때 "원본 매핑 없음" 사유가 파일당 정확히 한 번만 나오는지
// 검증하려고 존재한다. 위반이 1건뿐이면(예: violations 픽스처) 사유를
// 위반마다 중복 출력하는 잘못된 구현도 통과해 버려 판별력이 없다.
export function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}

export function clone(value) {
  return structuredClone(value);
}
