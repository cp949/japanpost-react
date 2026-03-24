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
      return gateway.fetchWithToken<JapanPostSearchCodeResponse>(
        createSearchCodeEndpoint(config, postalCode, query),
        {
          method: "GET",
        },
      );
    },

    addressZipRaw(requestBody: JapanPostAddressZipRequestBody) {
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
