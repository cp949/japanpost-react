import type {
  JapanPostAddressZipRequestBody,
  JapanPostSearchCodeChoikiType,
  JapanPostSearchCodeQuery,
  JapanPostSearchCodeSearchType,
} from "./clientTypes.js";

/**
 * 일본우정 클라이언트의 환경변수 기반 설정과 엔드포인트 조립을 담당한다.
 * 문자열 env 값을 여기서 미리 정규화해 실제 fetch 계층은 이미 검증된 값만 다루게 한다.
 */
const DEFAULT_BASE_URL = "https://api.da.pf.japanpost.jp";
const DEFAULT_TOKEN_PATH = "/api/v2/j/token";
const DEFAULT_SEARCH_CODE_PATH = "/api/v2/searchcode";
const DEFAULT_ADDRESS_ZIP_PATH = "/api/v2/addresszip";

export type JapanPostClientConfig = {
  addressZipPath: string;
  baseUrl: string;
  ecUid?: string;
  forwardedFor?: string;
  searchCodePath: string;
  searchCodeQuery: JapanPostSearchCodeQuery;
  tokenPath: string;
};

function normalizeBaseUrl(value: string): string {
  const trimmedValue = value.trim();

  // 스킴이 생략되면 https를 기본으로 붙여 운영 환경 오타를 줄인다.
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
}

function parseSearchCodeChoikiType(
  value: string | undefined,
): JapanPostSearchCodeChoikiType | undefined {
  const normalizedValue = value?.trim();

  if (normalizedValue === "1" || normalizedValue === "2") {
    return Number(normalizedValue) as JapanPostSearchCodeChoikiType;
  }

  return undefined;
}

function parseSearchCodeSearchType(
  value: string | undefined,
): JapanPostSearchCodeSearchType | undefined {
  const normalizedValue = value?.trim();

  if (normalizedValue === "1" || normalizedValue === "2") {
    return Number(normalizedValue) as JapanPostSearchCodeSearchType;
  }

  return undefined;
}

function appendEcUid(url: URL, ecUid: string | undefined) {
  const normalizedEcUid = ecUid?.trim();

  if (!normalizedEcUid) {
    return;
  }

  url.searchParams.set("ec_uid", normalizedEcUid);
}

function appendSearchCodeQuery(url: URL, query: JapanPostSearchCodeQuery) {
  appendEcUid(url, query.ec_uid);

  if (typeof query.page === "number") {
    url.searchParams.set("page", String(query.page));
  }

  if (typeof query.limit === "number") {
    url.searchParams.set("limit", String(query.limit));
  }

  if (query.choikitype !== undefined) {
    url.searchParams.set("choikitype", String(query.choikitype));
  }

  if (query.searchtype !== undefined) {
    url.searchParams.set("searchtype", String(query.searchtype));
  }
}

export function createJapanPostClientConfig(
  env: NodeJS.ProcessEnv,
): JapanPostClientConfig {
  return {
    addressZipPath: env.JAPANPOST_ADDRESS_ZIP_PATH ?? DEFAULT_ADDRESS_ZIP_PATH,
    baseUrl: normalizeBaseUrl(env.JAPANPOST_BASE_URL ?? DEFAULT_BASE_URL),
    ecUid: env.JAPANPOST_EC_UID,
    forwardedFor: env.JAPANPOST_X_FORWARDED_FOR,
    searchCodePath:
      env.JAPANPOST_SEARCH_CODE_PATH ?? DEFAULT_SEARCH_CODE_PATH,
    searchCodeQuery: {
      ec_uid: env.JAPANPOST_EC_UID,
      choikitype: parseSearchCodeChoikiType(
        env.JAPANPOST_SEARCH_CODE_CHOIKITYPE,
      ),
      searchtype: parseSearchCodeSearchType(
        env.JAPANPOST_SEARCH_CODE_SEARCHTYPE,
      ),
    },
    tokenPath: env.JAPANPOST_TOKEN_PATH ?? DEFAULT_TOKEN_PATH,
  };
}

export function createSearchCodeEndpoint(
  config: JapanPostClientConfig,
  postalCode: string,
  overrides: JapanPostSearchCodeQuery = {},
): URL {
  // searchcode는 path parameter + query 조합이므로 trailing slash를 정리한 뒤 이어붙인다.
  const endpoint = new URL(
    `${config.searchCodePath.replace(/\/$/, "")}/${postalCode}`,
    config.baseUrl,
  );

  appendSearchCodeQuery(endpoint, {
    ...config.searchCodeQuery,
    ...overrides,
  });
  return endpoint;
}

export function createAddressZipRequest(
  config: JapanPostClientConfig,
  requestBody: JapanPostAddressZipRequestBody,
): {
  endpoint: URL;
  requestBody: JapanPostAddressZipRequestBody;
} {
  // addresszip은 body 기반이라 URL에는 공통 ec_uid 정도만 붙이고 나머지는 그대로 body로 유지한다.
  const endpoint = new URL(config.addressZipPath, config.baseUrl);
  appendEcUid(endpoint, config.ecUid);

  return {
    endpoint,
    requestBody,
  };
}
