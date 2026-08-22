// chrome111 픽스처: 계약 하한을 111까지 올리면 structuredClone처럼 이미 지원되는
// 전역은 통과시키면서, 아직 하한을 넘지 못한 API(Array.fromAsync)는 걸러내는지 본다.
export function clone(value) {
  return structuredClone(value);
}

export async function collect(iterable) {
  return Array.fromAsync(iterable);
}
