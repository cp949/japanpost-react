// with-allow 픽스처: 이 파일 하나의 위반(Object.hasOwn)이 package.json의
// browserBaseline.allow로 실제로 지워지는지 본다.
export function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}
