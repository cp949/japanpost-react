import type {
  AdapterOptions,
  AddressAdapter,
  HealthStatus,
  JapanAddress,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  MomoPagerData,
} from "./japanPostAdapterTypes.js";
import type { JapanPostSearchCodeAddress } from "./japanPost/clientTypes.js";

export type {
  AdapterOptions,
  AddressAdapter,
  HealthStatus,
  JapanAddress,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  MomoPagerData,
} from "./japanPostAdapterTypes.js";
export { createHttpError } from "./adapter/errors.js";

import { createJapanPostClient } from "./japanPost/client.js";
import { createHttpError, isAdapterHttpError } from "./adapter/errors.js";
import {
  normalizeAddressRecord,
  normalizePostalCode,
} from "./japanPost/normalizers.js";

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

function toMomoPagerData(
  addresses: JapanAddress[],
  totalElements: number,
  pageNumber: number,
  rowsPerPage: number,
): MomoPagerData<JapanAddress> {
  return {
    elements: addresses,
    totalElements,
    pageNumber,
    rowsPerPage,
  };
}

function ensurePageRequest(pageNumber: number, rowsPerPage: number) {
  if (!Number.isInteger(pageNumber) || pageNumber < 0) {
    throw createHttpError(400, "pageNumber must be a non-negative integer");
  }

  if (!Number.isInteger(rowsPerPage) || rowsPerPage < 1) {
    throw createHttpError(400, "rowsPerPage must be a positive integer");
  }
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function requireMeaningfulSearchField(
  request: JapanPostAddresszipRequest,
): void {
  const hasMeaningfulSearchField = [
    request.freeword,
    request.prefCode,
    request.prefName,
    request.prefKana,
    request.prefRoma,
    request.cityCode,
    request.cityName,
    request.cityKana,
    request.cityRoma,
    request.townName,
    request.townKana,
    request.townRoma,
  ].some((value) => normalizeOptionalString(value) !== undefined);

  if (!hasMeaningfulSearchField) {
    throw createHttpError(400, "At least one search field must be provided");
  }
}

function toChoikiType(includeParenthesesTown: boolean | null | undefined) {
  if (includeParenthesesTown === true) {
    return 2;
  }

  if (includeParenthesesTown === false) {
    return 1;
  }

  return undefined;
}

function toSearchType(includeBusinessAddresses: boolean | null | undefined) {
  if (includeBusinessAddresses === true) {
    return 1;
  }

  if (includeBusinessAddresses === false) {
    return 2;
  }

  return undefined;
}

function toAddressZipFlag(value: boolean | null | undefined) {
  if (value === true) {
    return 1;
  }

  if (value === false) {
    return 0;
  }

  return undefined;
}

export function createJapanPostAdapter(
  options: AdapterOptions = {},
): AddressAdapter {
  const client = createJapanPostClient(options);

  async function getHealth(): Promise<HealthStatus> {
    try {
      await client.authenticate();
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

  return {
    getHealth,

    async searchcode(request: JapanPostSearchcodeRequest) {
      ensurePageRequest(request.pageNumber, request.rowsPerPage);

      const normalizedCode = normalizePostalCode(request.value);

      if (!/^\d{3,7}$/.test(normalizedCode)) {
        throw createHttpError(
          400,
          "Postal code must contain between 3 and 7 digits",
        );
      }

      const payload = await client.searchCodeRaw(normalizedCode, {
        page: request.pageNumber + 1,
        limit: request.rowsPerPage,
        choikitype: toChoikiType(request.includeParenthesesTown),
        searchtype: toSearchType(request.includeBusinessAddresses),
      });
      const addresses = ensureAddresses(payload).map(normalizeAddressRecord);

      return toMomoPagerData(
        addresses,
        payload.count ?? addresses.length,
        request.pageNumber,
        request.rowsPerPage,
      );
    },

    async addresszip(request: JapanPostAddresszipRequest) {
      ensurePageRequest(request.pageNumber, request.rowsPerPage);
      requireMeaningfulSearchField(request);

      const payload = await client.addressZipRaw({
        freeword: normalizeOptionalString(request.freeword),
        pref_code: normalizeOptionalString(request.prefCode),
        pref_name: normalizeOptionalString(request.prefName),
        pref_kana: normalizeOptionalString(request.prefKana),
        pref_roma: normalizeOptionalString(request.prefRoma),
        city_code: normalizeOptionalString(request.cityCode),
        city_name: normalizeOptionalString(request.cityName),
        city_kana: normalizeOptionalString(request.cityKana),
        city_roma: normalizeOptionalString(request.cityRoma),
        town_name: normalizeOptionalString(request.townName),
        town_kana: normalizeOptionalString(request.townKana),
        town_roma: normalizeOptionalString(request.townRoma),
        flg_getcity: toAddressZipFlag(request.includeCityDetails),
        flg_getpref: toAddressZipFlag(request.includePrefectureDetails),
        page: request.pageNumber + 1,
        limit: request.rowsPerPage,
      });
      const addresses = ensureAddresses(payload).map(normalizeAddressRecord);

      return toMomoPagerData(
        addresses,
        payload.count ?? addresses.length,
        request.pageNumber,
        request.rowsPerPage,
      );
    },
  };
}
