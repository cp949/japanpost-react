import type {
  JapanAddress,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  Page,
} from "@cp949/japanpost-react";

import type { JapanPostSearchCodeAddress } from "./japanPost/clientTypes.js";

export type AdapterOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

export type HealthStatus = {
  ok: boolean;
  error?: string;
  // readiness 스크립트가 다른 서버 인스턴스를 오인하지 않도록 필요할 때만 노출한다.
  instanceId?: string;
};

export type AddressAdapter = {
  // 단순 liveness가 아니라 "업스트림 호출 가능 여부"를 확인한다.
  getHealth(): Promise<HealthStatus>;
  searchcode(request: JapanPostSearchcodeRequest): Promise<Page<JapanAddress>>;
  addresszip(request: JapanPostAddresszipRequest): Promise<Page<JapanAddress>>;
};

export { createHttpError } from "./japanPost/errors.js";
export type {
  JapanAddress,
  JapanPostAddresszipRequest,
  JapanPostSearchcodeRequest,
  Page,
};

import { createJapanPostClient } from "./japanPost/client.js";
import { createHttpError, isAdapterHttpError } from "./japanPost/errors.js";
import {
  normalizeAddressRecord,
  normalizePostalCode,
} from "./japanPost/normalizers.js";

/**
 * minimal-api의 핵심 어댑터 계층이다.
 * 일본우정 원본 클라이언트를 외부에 직접 노출하지 않고,
 * 입력 검증, 업스트림 파라미터 변환, pager 계약 유지, 오류 상태 코드 정리를 이곳에서 담당한다.
 */
function ensureAddresses(payload: {
  addresses?: JapanPostSearchCodeAddress[] | null;
}): JapanPostSearchCodeAddress[] {
  // upstream 계약 이상을 빈 배열로 삼켜 버리면 "검색 결과 없음"과 구분할 수 없으므로 502로 실패시킨다.
  if (!Array.isArray(payload.addresses)) {
    throw createHttpError(
      502,
      "Address provider returned an unexpected response",
    );
  }

  return payload.addresses;
}

function toPage(
  addresses: JapanAddress[],
  totalElements: number,
  pageNumber: number,
  rowsPerPage: number,
): Page<JapanAddress> {
  // 외부 공개 계약은 0-based page를 사용하므로 adapter 경계에서 그대로 유지한다.
  return {
    elements: addresses,
    totalElements,
    pageNumber,
    rowsPerPage,
  };
}

function resolveTotalElements(count: unknown, fallback: number): number {
  // beta 응답이 count를 빼면 현재 페이지 길이만 totalElements로 내려 보수적으로 처리한다.
  if (count == null) {
    return fallback;
  }

  if (typeof count !== "number" || !Number.isFinite(count)) {
    throw createHttpError(
      502,
      "Address provider returned an unexpected response",
    );
  }

  return count;
}

function ensurePageRequest(pageNumber: number, rowsPerPage: number) {
  // 잘못된 pager 입력은 upstream 호출 전에 차단해 public contract를 분명히 한다.
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

function hasMeaningfulSearchField(
  request: JapanPostAddresszipRequest,
): boolean {
  // 공백만 있는 문자열은 "조건 없음"으로 취급한다.
  return [
    request.addressQuery,
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
}

function toChoikiType(includeParenthesesTown: boolean | null | undefined) {
  // 공개 boolean 계약을 upstream 숫자 플래그로 변환한다.
  if (includeParenthesesTown === true) {
    return 2;
  }

  if (includeParenthesesTown === false) {
    return 1;
  }

  return undefined;
}

function toAddressZipFlag(value: boolean | null | undefined) {
  // undefined는 "플래그를 보내지 않음"이므로 false와 구분한다.
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
      // health는 프로세스 생존이 아니라 실제 인증 가능 여부까지 본다.
      await client.authenticate();
      return { ok: true };
    } catch (error) {
      // 이미 정규화된 adapter 오류는 not ready payload로 내려 readiness 계약을 유지한다.
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

      // 표시 형식과 무관하게 업스트림에는 숫자만 전달한다.
      const normalizedCode = normalizePostalCode(request.postalCode);

      if (!/^\d{3,7}$/.test(normalizedCode)) {
        throw createHttpError(
          400,
          "Postal code must contain between 3 and 7 digits",
        );
      }

      const payload = await client.searchCodeRaw(normalizedCode, {
        // upstream은 1-based page를 쓰므로 adapter 경계에서만 변환한다.
        page: request.pageNumber + 1,
        limit: request.rowsPerPage,
        choikitype: toChoikiType(request.includeParenthesesTown),
      });
      const addresses = ensureAddresses(payload).map(normalizeAddressRecord);

      return toPage(
        addresses,
        resolveTotalElements(payload.count, addresses.length),
        request.pageNumber,
        request.rowsPerPage,
      );
    },

    async addresszip(request: JapanPostAddresszipRequest) {
      ensurePageRequest(request.pageNumber, request.rowsPerPage);

      if (!hasMeaningfulSearchField(request)) {
        // 빈 검색은 오류보다 빈 페이지가 더 자연스러워 초기 상태와 같은 의미로 반환한다.
        return toPage([], 0, request.pageNumber, request.rowsPerPage);
      }

      const payload = await client.addressZipRaw({
        // 빈 문자열은 넘기지 않아 의도치 않은 필터링을 막는다.
        freeword: normalizeOptionalString(request.addressQuery),
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
        // addresszip도 공개 0-based 페이지를 upstream 1-based 페이지로 바꿔 전달한다.
        page: request.pageNumber + 1,
        limit: request.rowsPerPage,
      });
      const addresses = ensureAddresses(payload).map(normalizeAddressRecord);

      return toPage(
        addresses,
        resolveTotalElements(payload.count, addresses.length),
        request.pageNumber,
        request.rowsPerPage,
      );
    },
  };
}
