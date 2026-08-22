// chrome90 픽스처: browserslist 하한이 80이 아닌 90이어도 baseline과 색인이 그 값을
// 그대로 따라가는지 본다. 곁들여 esbuild가 optional chaining을 Chrome 91부터만
// 원형 유지한다는 알려진 보수성(baseline.mjs 참고)이 90에서는 여전히 하향(문법 위반)
// 되는지도 같은 파일로 확인한다.
export function readName(obj) {
  return obj?.name;
}

export function hasKey(obj, key) {
  return Object.hasOwn(obj, key);
}

export function scheduleWork(callback) {
  // queueMicrotask는 Chrome 80 이하에서도 지원돼 어떤 하한에서도 위반이 아니다.
  // 이 fixture가 "전부 다 걸리는" 과보고 상태가 아님을 보여주는 음성 대조군이다.
  queueMicrotask(callback);
}

export function firstSettled(promises) {
  // Promise.any는 BCD 실측으로 Chrome 85다(buildCompatIndex로 직접 조회해 확인).
  // 81~90 구간에 엄격히 들어가므로 이 호출은 하한이 90이면 findings에서 빠져야
  // 하고, 하한이 80으로 하드코딩된 구현이라면 85>80이라 위반으로 잡힌다.
  // 즉 이 부재 단언은 하한이 실제로 90을 쓰는지(80에 묶여 있지 않은지)를
  // 판별하는 유일한 단언이다 — queueMicrotask(≤80)와 Object.hasOwn(93)은
  // 하한이 80이든 90이든 결과가 같아 판별력이 없다.
  return Promise.any(promises);
}
