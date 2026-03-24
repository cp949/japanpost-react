import type { JapanAddress } from "../japanPostAdapterTypes.js";

import type { JapanPostSearchCodeAddress } from "./clientTypes.js";
import { createHttpError } from "../adapter/errors.js";

/**
 * 일본우정 원본 응답을 minimal-api 공개 주소 계약으로 정규화한다.
 * 응답 이상을 여기서 걸러 public contract에서는 "형식이 맞는 주소"만 다루게 한다.
 */
function normalizePostalCodeOrThrow(
  value: string | number | null | undefined,
): string {
  const postalCode = normalizePostalCode(value);

  // 공개 계약은 후속 UI/라이브러리와 맞물리므로 항상 7자리 postalCode를 보장해야 한다.
  if (!/^\d{7}$/.test(postalCode)) {
    throw createHttpError(
      502,
      "Address provider returned an invalid postal code",
    );
  }

  return postalCode;
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
}

export function normalizePostalCode(
  value: string | number | null | undefined,
): string {
  // upstream이 숫자/문자열을 섞어 보내도 우선 가장 느슨한 공통 형식인 숫자 문자열로 맞춘다.
  return String(value ?? "").replace(/[^\d]/g, "");
}

export function normalizeAddressRecord(
  record: JapanPostSearchCodeAddress,
): JapanAddress {
  const postalCode = normalizePostalCodeOrThrow(record.zip_code);
  const prefecture = record.pref_name?.trim() ?? "";
  const city = record.city_name?.trim() ?? "";
  const town = record.town_name?.trim() ?? "";
  const structuredAddress = joinAddressParts([
    prefecture,
    city,
    town,
    record.block_name,
    record.other_name,
  ]);
  const rawAddress = record.address?.trim() ?? "";
  const address =
    // 원본 address가 구조화 필드를 이미 포함하면 upstream가 조합한 완성형 문구를 보존한다.
    // 그렇지 않으면 중복 가능성을 줄이기 위해 구조화 조합 결과를 우선한다.
    rawAddress && (!structuredAddress || rawAddress.includes(structuredAddress))
      ? rawAddress
      : structuredAddress || rawAddress;

  return {
    postalCode,
    prefecture,
    prefectureKana: record.pref_kana?.trim() || undefined,
    city,
    cityKana: record.city_kana?.trim() || undefined,
    town,
    townKana: record.town_kana?.trim() || undefined,
    address,
    provider: "japan-post",
  };
}
