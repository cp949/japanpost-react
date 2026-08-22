// no-browserslist 픽스처: package.json에 browserslist가 없다. 계약의 정본이
// 없으므로 loadBaseline은 조용히 통과시키지 않고 던져야 한다. 내용 자체는
// 검사에 도달하지 않으므로 무엇이든 상관없다.
export function noop() {}
