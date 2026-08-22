// multi-entry 픽스처의 "./feature-b" require 조건. import 조건(feature-b.mjs)과
// 다른 위반(Object.groupBy)을 심어 조건 map의 cjs 갈래도 별도로 스캔되는지 본다.
function groupThings(items) {
  return Object.groupBy(items, (item) => item.kind);
}

module.exports = { groupThings };
