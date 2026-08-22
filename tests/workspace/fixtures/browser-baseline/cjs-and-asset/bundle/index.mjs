// cjs-and-asset 픽스처의 import 조건. 위반 없이 깨끗하게 둬서 위반은 require
// 조건(index.cjs) 쪽에서만 나오게 한다. 이 픽스처의 초점은 "JS 확장자만
// 골라내는지"이지 조건별 개별 스캔 여부가 아니다.
export function ping() {
  return "pong";
}
