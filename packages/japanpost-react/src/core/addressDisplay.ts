import type { JapanAddress } from "./types";
import { formatJapanPostalCode } from "./formatters";

export function formatJapanAddressDisplay(address: JapanAddress): string {
  return address.address.replace(/\s+/g, " ").trim();
}

export function formatJapanAddressSearchResultLabel(
  address: JapanAddress,
): string {
  return `${formatJapanPostalCode(address.postalCode)} ${formatJapanAddressDisplay(address)}`;
}
