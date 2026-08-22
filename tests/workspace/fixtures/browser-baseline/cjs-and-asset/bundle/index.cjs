// cjs-and-asset 픽스처의 require 조건. .cjs도 JS 확장자이므로 스캔 대상에
// 들어와야 한다 — 위반(Object.hasOwn)을 심어 실제로 스캔됐는지 증명한다.
function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}

module.exports = { hasKey };
