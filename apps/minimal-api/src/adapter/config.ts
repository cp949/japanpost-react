import type {
  JapanPostAddressZipFreewordRequest,
  JapanPostSearchCodeChoikiType,
  JapanPostSearchCodeQuery,
  JapanPostSearchCodeSearchType,
} from "../japanPostAdapterTypes.js";

const DEFAULT_BASE_URL = "https://api.da.pf.japanpost.jp";
const DEFAULT_TOKEN_PATH = "/api/v2/j/token";
const DEFAULT_SEARCH_CODE_PATH = "/api/v2/searchcode";
const DEFAULT_ADDRESS_ZIP_PATH = "/api/v2/addresszip";
const DEFAULT_ADDRESS_SEARCH_LIMIT = 20;

export type JapanPostAdapterConfig = {
  addressSearchLimit: number;
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

export function createJapanPostAdapterConfig(
  env: NodeJS.ProcessEnv,
): JapanPostAdapterConfig {
  return {
    addressSearchLimit: DEFAULT_ADDRESS_SEARCH_LIMIT,
    addressZipPath: env.JAPAN_POST_ADDRESS_ZIP_PATH ?? DEFAULT_ADDRESS_ZIP_PATH,
    baseUrl: normalizeBaseUrl(env.JAPAN_POST_BASE_URL ?? DEFAULT_BASE_URL),
    ecUid: env.JAPAN_POST_EC_UID,
    forwardedFor: env.JAPAN_POST_X_FORWARDED_FOR,
    searchCodePath:
      env.JAPAN_POST_SEARCH_CODE_PATH ?? DEFAULT_SEARCH_CODE_PATH,
    searchCodeQuery: {
      ec_uid: env.JAPAN_POST_EC_UID,
      choikitype: parseSearchCodeChoikiType(
        env.JAPAN_POST_SEARCH_CODE_CHOIKITYPE,
      ),
      searchtype: parseSearchCodeSearchType(
        env.JAPAN_POST_SEARCH_CODE_SEARCHTYPE,
      ),
    },
    tokenPath: env.JAPAN_POST_TOKEN_PATH ?? DEFAULT_TOKEN_PATH,
  };
}

export function createSearchCodeEndpoint(
  config: JapanPostAdapterConfig,
  postalCode: string,
): URL {
  const endpoint = new URL(
    `${config.searchCodePath.replace(/\/$/, "")}/${postalCode}`,
    config.baseUrl,
  );

  appendSearchCodeQuery(endpoint, config.searchCodeQuery);
  return endpoint;
}

export function createAddressZipRequest(
  config: JapanPostAdapterConfig,
  query: string,
): {
  endpoint: URL;
  requestBody: JapanPostAddressZipFreewordRequest;
} {
  const endpoint = new URL(config.addressZipPath, config.baseUrl);
  appendEcUid(endpoint, config.ecUid);

  return {
    endpoint,
    requestBody: {
      freeword: query,
      flg_getcity: 0,
      flg_getpref: 0,
      page: 1,
      limit: config.addressSearchLimit,
    },
  };
}
