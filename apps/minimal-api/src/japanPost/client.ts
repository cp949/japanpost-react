import { createHttpError } from "./errors.js";
import type {
  JapanPostAddressZipRequestBody,
  JapanPostAddressZipResponse,
  JapanPostSearchCodeQuery,
  JapanPostSearchCodeResponse,
} from "./clientTypes.js";
import {
  createAddressZipRequest,
  createJapanPostClientConfig,
  createSearchCodeEndpoint,
} from "./clientConfig.js";
import { createJapanPostGateway } from "./gateway.js";
import { createJapanPostTokenClient } from "./tokenClient.js";

/**
 * 일본우정 API 하위 클라이언트를 조립하는 모듈이다.
 * 토큰 발급, 인증 포함 fetch, 엔드포인트 생성 로직을 묶어 adapter가 검색 의미만 다루게 한다.
 */
export type JapanPostClientOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

export type JapanPostClient = {
  addressZipRaw(
    requestBody: JapanPostAddressZipRequestBody,
  ): Promise<JapanPostAddressZipResponse>;
  authenticate(): Promise<string>;
  searchCodeRaw(
    postalCode: string,
    query?: JapanPostSearchCodeQuery,
  ): Promise<JapanPostSearchCodeResponse>;
};

export function createJapanPostClient(
  options: JapanPostClientOptions = {},
): JapanPostClient {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw createHttpError(500, "Fetch is not available in this environment");
  }

  const config = createJapanPostClientConfig(env);
  // 토큰 획득과 실제 API 호출을 분리해 각자 다른 캐시/재시도 정책을 유지한다.
  const tokenClient = createJapanPostTokenClient({
    baseUrl: config.baseUrl,
    env,
    fetch: fetchImpl,
    forwardedFor: config.forwardedFor,
    tokenPath: config.tokenPath,
  });
  const gateway = createJapanPostGateway({
    clearCachedToken: tokenClient.clearCachedToken,
    fetch: fetchImpl,
    requestToken: tokenClient.requestToken,
  });

  return {
    authenticate: () => tokenClient.requestToken(),

    searchCodeRaw(postalCode: string, query: JapanPostSearchCodeQuery = {}) {
      // searchcode는 GET + path parameter + query string 계약을 따른다.
      return gateway.fetchWithToken<JapanPostSearchCodeResponse>(
        createSearchCodeEndpoint(config, postalCode, query),
        {
          method: "GET",
        },
      );
    },

    addressZipRaw(requestBody: JapanPostAddressZipRequestBody) {
      // addresszip은 POST body 기반 계약이라 endpoint/body를 함께 조립한다.
      const { endpoint, requestBody: body } = createAddressZipRequest(
        config,
        requestBody,
      );

      return gateway.fetchWithToken<JapanPostAddressZipResponse>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
  };
}
