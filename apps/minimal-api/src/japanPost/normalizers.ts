import type { JapanAddress } from "../japanPostAdapterTypes.js";

import type { JapanPostSearchCodeAddress } from "./clientTypes.js";
import { createHttpError } from "../adapter/errors.js";

function normalizePostalCodeOrThrow(
  value: string | number | null | undefined,
): string {
  const postalCode = normalizePostalCode(value);

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
