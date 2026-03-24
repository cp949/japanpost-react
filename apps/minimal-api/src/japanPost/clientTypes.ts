/**
 * 일본우정 원본 HTTP 계약 타입이다.
 * public contract가 아니라 upstream 변화 흡수용 타입이므로 optional/null 가능성을 그대로 보존한다.
 */
export type JapanPostTokenResponse = {
  token?: string;
  token_type?: string;
  expires_in?: number;
};

export type JapanPostErrorResponse = {
  error_code?: string;
  message?: string;
  request_id?: string;
};

export type JapanPostSearchCodeAddress = {
  zip_code?: string | number | null;
  pref_name?: string | null;
  pref_kana?: string | null;
  city_name?: string | null;
  city_kana?: string | null;
  town_name?: string | null;
  town_kana?: string | null;
  block_name?: string | null;
  other_name?: string | null;
  address?: string | null;
};

export type JapanPostSearchCodeResponse = {
  count?: number | null;
  addresses?: JapanPostSearchCodeAddress[] | null;
};

export type JapanPostSearchCodeChoikiType = 1 | 2;

export type JapanPostSearchCodeSearchType = 1 | 2;

export type JapanPostSearchCodeQuery = {
  // upstream searchcode는 1-based page를 사용하므로 adapter에서 변환해 채운다.
  page?: number;
  limit?: number;
  ec_uid?: string;
  choikitype?: JapanPostSearchCodeChoikiType;
  searchtype?: JapanPostSearchCodeSearchType;
};

export type JapanPostAddressZipFlag = 0 | 1;

export type JapanPostAddressZipRequestBody = {
  pref_code?: string;
  pref_name?: string;
  pref_kana?: string;
  pref_roma?: string;
  city_code?: string;
  city_name?: string;
  city_kana?: string;
  city_roma?: string;
  town_name?: string;
  town_kana?: string;
  town_roma?: string;
  freeword?: string;
  flg_getcity?: JapanPostAddressZipFlag;
  flg_getpref?: JapanPostAddressZipFlag;
  page?: number;
  limit?: number;
};

export type JapanPostAddressZipResponse = {
  count?: number | null;
  addresses?: JapanPostSearchCodeAddress[] | null;
};
