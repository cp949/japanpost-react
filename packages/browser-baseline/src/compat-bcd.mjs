/**
 * @mdn/browser-compat-data(BCD)에서 런타임 API 판정 색인을 파생한다.
 *
 * 게이트 2의 검사 대상은 손으로 고른 목록이 아니라 이 module이 만드는 색인이다.
 * 계약의 Chrome 하한은 인자로 받는다 — 정본은 package.json#browserslist이며
 * @repo/browser-baseline가 파생값을 만든다.
 */
import { createRequire } from "node:module";

/** "≤80", "<=31" 형태에서 경계 버전을 뽑는 패턴이다. */
const AT_MOST = /^(?:≤|<=)(\d+)/;

/**
 * 지원으로 세지 않는 한정자다.
 *
 * flags는 브라우저 플래그가 필요하다는 뜻이고, prefix는 접두사 붙은 이름으로만
 * 존재한다는 뜻이며, alternative_name은 아예 다른 이름으로만 있다는 뜻이다.
 * 셋 다 계약이 요구하는 기본 표준 표면이 아니다.
 *
 * partial_implementation은 여기 없다. 부분 구현까지 위반으로 올리면 과보고가 된다.
 */
const NOT_PLAIN_SUPPORT = ["flags", "prefix", "alternative_name"];

/** 한정자가 붙어 기본 지원으로 셀 수 없는 항목인지 본다. */
function hasDisqualifier(entry) {
  return NOT_PLAIN_SUPPORT.some((field) => entry[field] !== undefined);
}

/**
 * version_added 하나를 Chrome 도입 버전 숫자로 바꾼다.
 *
 * 판정할 수 없으면 null이다. 모르는 값을 아무 숫자로 지어내면
 * 계약이 조용히 날조되므로 폴백하지 않는다.
 */
function normalizeVersionAdded(versionAdded) {
  // 미지원과 프리뷰 전용은 어떤 하한에서도 위반이다.
  if (versionAdded === false || versionAdded === "preview") {
    return Number.POSITIVE_INFINITY;
  }

  // 버전은 모르지만 지원은 된다는 뜻이다. 어떤 하한도 넘지 않도록 0으로 둔다.
  if (versionAdded === true) {
    return 0;
  }

  // 지원 여부 자체를 모른다. 판정하지 않는다.
  if (versionAdded === null || versionAdded === undefined) {
    return null;
  }

  if (typeof versionAdded !== "string") {
    return null;
  }

  const atMost = AT_MOST.exec(versionAdded);

  // "≤80"은 "80 이하에서 도입, 정확한 시점 미상"이다.
  // 경계값을 도입 버전으로 보면 실제 도입이 더 일러도 과보고 쪽이라 계약을 깨지 않는다.
  if (atMost !== null) {
    return Number.parseInt(atMost[1], 10);
  }

  const parsed = Number.parseInt(versionAdded, 10);

  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * BCD __compat.support.chrome 값 하나를 Chrome 도입 버전 숫자로 바꾼다.
 *
 * plain object와 객체 배열 두 형태를 받는다.
 *
 * 배열은 지원 이력이며 최신이 앞이다. 한정자가 붙은 원소를 먼저 걷어낸 뒤,
 * 현재까지 끊기지 않고 이어지는 구간의 가장 이른 시작점을 취한다.
 * 단순히 첫 원소를 쓰면 AbortSignal.timeout이 124로 나온다 — 실제로는 103부터
 * 연속 존재하고 103~123이 partial일 뿐이라 과대 보고다. 반대로 최솟값을 쓰면
 * 도입-제거-재도입 이력에서 이미 사라진 옛 버전을 답해 미탐이 된다.
 *
 * @param {unknown} support BCD의 support.chrome 값
 * @returns {number | null} 도입 버전. 판정할 수 없으면 null
 */
export function normalizeChromeSupport(support) {
  if (support === null || support === undefined) {
    return null;
  }

  const raw = (Array.isArray(support) ? support : [support]).filter(
    (entry) => entry !== null && typeof entry === "object",
  );

  if (raw.length === 0) {
    return null;
  }

  const entries = raw.filter((entry) => !hasDisqualifier(entry));

  // 원소는 있었으나 전부 한정자가 붙었다. 기본 지원이 없다는 뜻이다.
  if (entries.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  const current = entries[0];

  // 최신 유효 표준 기록이 제거된 뒤 재도입되지 않았으면 현재는 미지원이다.
  // false는 제거되지 않았음을 명시하는 값이므로 제거 기록으로 보지 않는다.
  if (
    current.version_removed !== undefined &&
    current.version_removed !== null &&
    current.version_removed !== false
  ) {
    return Number.POSITIVE_INFINITY;
  }

  // 최신(index 0)에서 과거로 내려가며 구간이 이어지는 동안 시작점을 낮춘다.
  let earliest = null;

  for (let index = 0; index < entries.length; index += 1) {
    const normalized = normalizeVersionAdded(entries[index].version_added);

    if (normalized === null) {
      break;
    }

    earliest = normalized;

    const older = entries[index + 1];

    if (older === undefined) {
      break;
    }

    // 더 오래된 구간이 지금 구간의 시작점에서 끝나지 않았다면 그 사이에
    // 지원이 없던 시기가 있다. 재도입 이력이므로 여기서 멈춘다.
    if (
      String(older.version_removed) !== String(entries[index].version_added)
    ) {
      break;
    }
  }

  return earliest;
}

/**
 * BCD를 CommonJS require로 읽는다.
 *
 * import attributes(`with { type: "json" }`)는 Node 20.10+에서만 동작한다.
 * engines.node가 ">=20"이므로 전 구간에서 동작하는 경로를 쓴다.
 * 20MB JSON이라 프로세스당 한 번만 읽는다.
 */
const require = createRequire(import.meta.url);

/** 20MB JSON을 두 번 읽지 않도록 모듈 수준에서 memoize한다. */
let bcdCache = null;

function loadBcd() {
  if (bcdCache === null) {
    bcdCache = require("@mdn/browser-compat-data");
  }

  return bcdCache;
}

/**
 * 전역 함수·객체가 사는 BCD source_file 접두사다.
 *
 * 전역은 javascript.builtins가 아니라 api.*에 있다(structuredClone, reportError,
 * queueMicrotask, fetch 등). "자식이 없는 리프 = 전역" 휴리스틱은 틀렸다 —
 * 그런 리프 86개 중 79개는 멤버가 문서화되지 않은 인터페이스다.
 * source_file만이 신뢰 가능한 신호이며 해당 항목은 정확히 21개다.
 */
const GLOBALS_SOURCE_PREFIX = "api/_globals/";

/** api.*에서 static 멤버에 붙는 접미사다. 완전히 신뢰 가능한 구분 신호다. */
const STATIC_SUFFIX = "_static";

/**
 * javascript.builtins에서 인스턴스 멤버를 가리키는 spec_url 조각이다.
 *
 * 이 네임스페이스는 키 경로로 static과 instance를 구분할 수 없다 —
 * javascript.builtins.Array.at(instance)와 .from(static)의 shape가 같고
 * 리터럴 prototype 키는 존재하지 않는다. TC39 스펙 URL 명명 관례가 유일한 신호다.
 *
 * BCD 스키마가 보장하는 필드가 아니므로 휴리스틱이다.
 * spec_url이 없는 리프(Error.stack, Function.caller 등 10개)는 판정하지 않는다.
 */
const PROTOTYPE_SPEC = ".prototype.";

/**
 * Tier 2 색인에 넣을 api.* 소유 타입이다.
 *
 * API 목록이 아니라 수신자 타입 목록이다. 새 API가 나와도 갱신할 필요가 없다 —
 * BCD가 공급한다. 갱신 계기는 이 라이브러리가 새 브라우저 인터페이스를
 * 다루기 시작할 때뿐이다.
 *
 * 목록 밖 소유 타입은 최소 버전 계산에도 참여하지 않는다. AbortSignal.reason이
 * 탐지되는 이유가 이것이다 — CloseEvent.reason(15)이 섞이면 최소값이 15로 떨어져
 * 색인에서 빠진다.
 */
const API_OWNERS = new Set([
  "AbortController",
  "AbortSignal",
  "Blob",
  "Crypto",
  "CustomEvent",
  "DOMTokenList",
  "Document",
  "Element",
  "Event",
  "EventTarget",
  "File",
  "FormData",
  "HTMLCollection",
  "HTMLElement",
  "HTMLFormElement",
  "HTMLInputElement",
  "Headers",
  "History",
  "Location",
  "Navigator",
  "Node",
  "NodeList",
  "Performance",
  "ReadableStream",
  "Request",
  "Response",
  "Storage",
  "TextDecoder",
  "TextEncoder",
  "URL",
  "URLSearchParams",
  "Window",
]);

/** Tier 2 색인에 넣을 javascript.builtins 소유 타입이다. API_OWNERS와 같은 성격이다. */
const BUILTIN_OWNERS = new Set([
  "Array",
  "ArrayBuffer",
  "BigInt64Array",
  "BigUint64Array",
  "Date",
  "Error",
  "Float16Array",
  "Float32Array",
  "Float64Array",
  "Function",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Intl",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "Proxy",
  "Reflect",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "TypedArray",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "WeakMap",
  "WeakSet",
]);

/**
 * 타입이 고정된 전역과 그 인터페이스다.
 *
 * crypto.randomUUID와 navigator.userAgentData는 수신자가 변수가 아니라
 * BCD api/_globals에 등록된 전역이며 타입이 하나로 정해진다.
 * 일반 Tier 2(수신자 미상)와 다르므로 Tier 1으로 확정 판정한다.
 */
const KNOWN_GLOBAL_TYPES = new Map([
  ["caches", "CacheStorage"],
  ["crypto", "Crypto"],
  ["document", "Document"],
  ["history", "History"],
  ["localStorage", "Storage"],
  ["location", "Location"],
  ["navigator", "Navigator"],
  ["performance", "Performance"],
  ["sessionStorage", "Storage"],
  ["window", "Window"],
]);

/**
 * 옵션·파라미터 서브피처의 고정 BCD 키다.
 *
 * BCD 명명 규칙은 `<파라미터명>_parameter`이고, 옵션 객체의 개별 필드는
 * `options_<옵션명>_parameter`로 한 단계 더 중첩된다.
 * 이 키가 해석되지 않으면 던진다 — 우리가 관리하는 매핑이므로
 * BCD 업그레이드로 낡았을 때 조용히 통과하는 대신 게이트가 깨져야 한다.
 */
const SPECIAL_KEYS = new Map([
  [
    "Error.cause",
    ["javascript", "builtins", "Error", "Error", "options_cause_parameter"],
  ],
  [
    "addEventListener.signal",
    [
      "api",
      "EventTarget",
      "addEventListener",
      "options_parameter",
      "options_signal_parameter",
    ],
  ],
]);

/** BCD 트리에서 경로를 따라 노드를 찾는다. 없으면 undefined다. */
function resolvePath(root, segments) {
  let node = root;

  for (const segment of segments) {
    if (node === null || typeof node !== "object") {
      return undefined;
    }

    node = node[segment];
  }

  return node;
}

/** 노드의 __compat.support.chrome을 정규화한다. __compat이 없으면 null이다. */
function chromeOf(node) {
  if (node === null || typeof node !== "object") {
    return null;
  }

  const compat = node.__compat;

  if (compat === null || compat === undefined) {
    return null;
  }

  return normalizeChromeSupport(compat.support?.chrome);
}

/** 자식 키를 훑는다. __compat과 @@로 시작하는 well-known symbol은 멤버가 아니다. */
function memberKeys(node) {
  return Object.keys(node).filter(
    (key) => key !== "__compat" && !key.startsWith("@@"),
  );
}

/**
 * javascript.builtins 리프가 인스턴스 멤버인지 본다.
 *
 * spec_url이 없으면 판정하지 않는다 — static으로도 instance로도 넣지 않는다.
 * 잘못 분류하느니 빠지는 편이 낫다.
 *
 * @returns {boolean | null} 인스턴스면 true, static이면 false, 판정 불가면 null
 */
function isPrototypeMember(node) {
  const specUrl = node?.__compat?.spec_url;

  if (specUrl === undefined) {
    return null;
  }

  const urls = Array.isArray(specUrl) ? specUrl : [specUrl];

  return urls.some((url) => String(url).includes(PROTOTYPE_SPEC));
}

/**
 * members 색인에 후보를 더한다. 같은 이름의 최소 버전을 유지한다.
 *
 * Chrome이 출시한 적 없는 소유 타입(chrome이 유한하지 않음)은 후보에서 뺀다.
 * Tier 2는 수신자 타입을 모르므로, 모든 소유 타입이 Chrome 미출시인 이름을
 * 보고하면 순수 노이즈다 — createTouch, mozSetImageElement, preferredStyleSheetSet
 * 같은 이름 71개가 여기 해당하며 출력에는 "Chrome Infinity+"가 찍힌다.
 * 수신자가 증명된 Tier 1(globals·statics)은 Infinity를 그대로 둔다 —
 * 거기서는 Chrome 미출시 API 사용이 진짜 위반이다.
 */
function addMember(candidates, name, ownerPath, chrome) {
  if (!Number.isFinite(chrome)) {
    return;
  }

  const existing = candidates.get(name);

  if (existing === undefined) {
    candidates.set(name, { chrome, owners: [ownerPath] });
    return;
  }

  existing.owners.push(ownerPath);
  existing.chrome = Math.min(existing.chrome, chrome);
}

/**
 * 계약의 Chrome 하한에 맞춰 판정 색인을 만든다.
 *
 * 하한 이하에서 이미 지원되는 항목은 이 시점에 색인에서 빠진다.
 * 기준선을 올리면 목록을 손으로 편집하지 않아도 검사 대상이 줄어든다.
 *
 * @param {{ minChrome: number }} options
 */
export function buildCompatIndex({ minChrome }) {
  if (!Number.isInteger(minChrome)) {
    throw new Error(
      `minChrome은 정수여야 한다. 받은 값: ${JSON.stringify(minChrome)}`,
    );
  }

  const bcd = loadBcd();
  const globals = new Map();
  const statics = new Map();
  const memberCandidates = new Map();

  // 1) api.* — 전역, static, 인스턴스 멤버를 한 번에 훑는다.
  for (const [interfaceName, node] of Object.entries(bcd.api ?? {})) {
    if (node === null || typeof node !== "object") {
      continue;
    }

    const sourceFile = node.__compat?.source_file ?? "";
    const interfaceChrome = chromeOf(node);

    // 전역 함수·객체는 source_file이 api/_globals/로 시작한다.
    if (
      String(sourceFile).startsWith(GLOBALS_SOURCE_PREFIX) &&
      interfaceChrome !== null &&
      interfaceChrome > minChrome
    ) {
      globals.set(interfaceName, {
        chrome: interfaceChrome,
        path: `api.${interfaceName}`,
      });
    }

    const inAllowlist = API_OWNERS.has(interfaceName);

    for (const key of memberKeys(node)) {
      const chrome = chromeOf(node[key]);

      if (chrome === null || chrome <= minChrome) {
        continue;
      }

      if (key.endsWith(STATIC_SUFFIX)) {
        const member = key.slice(0, -STATIC_SUFFIX.length);

        statics.set(`${interfaceName}.${member}`, {
          chrome,
          path: `api.${interfaceName}.${key}`,
        });
        continue;
      }

      // 인터페이스 자기 자신(생성자)은 재귀 중첩이다. 멤버가 아니다.
      if (key === interfaceName) {
        continue;
      }

      // 타입이 고정된 전역의 멤버는 Tier 1으로 조회되도록 statics에도 넣는다.
      statics.set(`${interfaceName}.${key}`, {
        chrome,
        path: `api.${interfaceName}.${key}`,
      });

      if (inAllowlist) {
        addMember(memberCandidates, key, `api.${interfaceName}`, chrome);
      }
    }
  }

  // 2) javascript.builtins.* — 최상위 이름은 전역, 자식은 spec_url로 갈린다.
  for (const [builtinName, node] of Object.entries(
    bcd.javascript?.builtins ?? {},
  )) {
    if (node === null || typeof node !== "object") {
      continue;
    }

    const builtinChrome = chromeOf(node);

    if (builtinChrome !== null && builtinChrome > minChrome) {
      globals.set(builtinName, {
        chrome: builtinChrome,
        path: `javascript.builtins.${builtinName}`,
      });
    }

    const inAllowlist = BUILTIN_OWNERS.has(builtinName);

    for (const key of memberKeys(node)) {
      const child = node[key];
      const chrome = chromeOf(child);

      if (chrome === null || chrome <= minChrome) {
        continue;
      }

      // 생성자 자기 자신은 재귀 중첩이다. 최상위에서 이미 처리했다.
      if (key === builtinName) {
        continue;
      }

      const prototypeMember = isPrototypeMember(child);

      // spec_url이 없으면 판정하지 않는다.
      if (prototypeMember === null) {
        continue;
      }

      if (prototypeMember) {
        if (inAllowlist) {
          addMember(
            memberCandidates,
            key,
            `javascript.builtins.${builtinName}`,
            chrome,
          );
        }
        continue;
      }

      statics.set(`${builtinName}.${key}`, {
        chrome,
        path: `javascript.builtins.${builtinName}.${key}`,
      });
    }
  }

  // 3) 최소 버전이 하한을 넘는 이름만 members 색인에 남긴다.
  //    허용목록 밖 소유 타입은 애초에 후보에 들어오지 않았으므로
  //    최소 버전 계산을 오염시키지 않는다.
  const members = new Map();

  for (const [name, entry] of memberCandidates) {
    if (entry.chrome > minChrome) {
      members.set(name, entry);
    }
  }

  // 4) 옵션 서브피처는 고정 키다. 해석 실패는 매핑이 낡았다는 뜻이므로 던진다.
  const special = new Map();

  for (const [name, segments] of SPECIAL_KEYS) {
    const node = resolvePath(bcd, segments);
    const chrome = chromeOf(node);

    if (chrome === null) {
      throw new Error(
        `BCD 키 ${segments.join(".")}를 해석할 수 없다. 특수 판정 매핑이 낡았다. @mdn/browser-compat-data 버전을 확인한다.`,
      );
    }

    special.set(name, { chrome, path: segments.join(".") });
  }

  if (globals.size === 0 || statics.size === 0 || members.size === 0) {
    throw new Error(
      `BCD 색인이 비었다. 검사 대상이 없는 상태는 통과가 아니라 파생 실패다. minChrome=${minChrome}`,
    );
  }

  return {
    minChrome,
    globals,
    statics,
    members,
    special,
    knownGlobalTypes: KNOWN_GLOBAL_TYPES,
  };
}
