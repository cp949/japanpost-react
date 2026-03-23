import type { JapanAddress } from "@cp949/japanpost-react";
import type {
  AdapterOptions,
  AddressAdapter,
  HealthStatus,
  JapanPostAddressZipResponse,
  JapanPostSearchCodeAddress,
  JapanPostSearchCodeResponse,
} from "./japanPostAdapterTypes.js";

export type {
  AdapterOptions,
  AddressAdapter,
  AddressSearchResult,
  HealthStatus,
  PostalCodeResult,
} from "./japanPostAdapterTypes.js";
export { createHttpError } from "./adapter/errors.js";

import { createHttpError, isAdapterHttpError } from "./adapter/errors.js";
import {
  createAddressZipRequest,
  createJapanPostAdapterConfig,
  createSearchCodeEndpoint,
} from "./adapter/config.js";
import { createJapanPostGateway } from "./adapter/japanPostGateway.js";
import {
  normalizeAddressRecord,
  normalizePostalCode,
} from "./adapter/normalizers.js";

function ensureAddresses(payload: {
  addresses?: JapanPostSearchCodeAddress[] | null;
}): JapanPostSearchCodeAddress[] {
  if (!Array.isArray(payload.addresses)) {
    throw createHttpError(
      502,
      "Address provider returned an unexpected response",
    );
  }

  return payload.addresses;
}

import { createJapanPostTokenClient } from "./adapter/tokenClient.js";

export function createJapanPostAdapter(
  options: AdapterOptions = {},
): AddressAdapter {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? globalThis.fetch;

  if (!fetchImpl) {
    throw createHttpError(500, "Fetch is not available in this environment");
  }

  const config = createJapanPostAdapterConfig(env);
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

  async function getHealth(): Promise<HealthStatus> {
    try {
      await tokenClient.requestToken();
      return { ok: true };
    } catch (error) {
      if (isAdapterHttpError(error) && error instanceof Error) {
        return {
          ok: false,
          error: error.message,
        };
      }

      throw error;
    }
  }

  function ensureAddressesFound<T extends { addresses: JapanAddress[] }>(
    payload: T,
  ): T {
    if (payload.addresses.length === 0) {
      throw createHttpError(404, "No matching addresses found");
    }

    return payload;
  }

  return {
    getHealth,

    async lookupPostalCode(postalCode: string) {
      const normalizedCode = normalizePostalCode(postalCode);

      if (!/^\d{3,7}$/.test(normalizedCode)) {
        throw createHttpError(
          400,
          "Postal code must contain between 3 and 7 digits",
        );
      }

      const endpoint = createSearchCodeEndpoint(config, normalizedCode);
      const payload = await gateway.fetchWithToken<JapanPostSearchCodeResponse>(
        endpoint,
        {
          method: "GET",
        },
      );
      const addresses = ensureAddresses(payload);

      return ensureAddressesFound({
        postalCode: normalizedCode,
        addresses: addresses.map(normalizeAddressRecord),
      });
    },

    async searchAddress(query: string) {
      const normalizedQuery = query.trim();

      if (!normalizedQuery) {
        throw createHttpError(400, "Query parameter q is required");
      }

      const { endpoint, requestBody } = createAddressZipRequest(
        config,
        normalizedQuery,
      );
      const payload = await gateway.fetchWithToken<JapanPostAddressZipResponse>(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify(requestBody),
        },
      );
      const addresses = ensureAddresses(payload);

      return ensureAddressesFound({
        query: normalizedQuery,
        addresses: addresses.map(normalizeAddressRecord),
      });
    },
  };
}
