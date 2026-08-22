// multi-entry 픽스처의 "./feature-a" 서브경로 엔트리. 루트와 다른 고유 위반
// (reportError)을 심어 이 파일이 실제로 개별 스캔되는지 구분해서 증명한다.
export function report(error) {
  reportError(error);
}
