// tier 2 위반 픽스처: Array.prototype.at은 수신자 타입을 정적으로 모르므로 tier 2다.
export function last(items) {
  return items.at(-1);
}
