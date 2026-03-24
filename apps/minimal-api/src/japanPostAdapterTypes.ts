export type AdapterOptions = {
  env?: NodeJS.ProcessEnv;
  fetch?: typeof fetch;
};

export type JapanAddress = {
  postalCode: string;
  prefecture: string;
  prefectureKana?: string;
  city: string;
  cityKana?: string;
  town: string;
  townKana?: string;
  address: string;
  provider: "japan-post";
};

export type HealthStatus = {
  ok: boolean;
  error?: string;
  instanceId?: string;
};

export type MomoPagerData<T> = {
  elements: T[];
  totalElements: number;
  pageNumber: number;
  rowsPerPage: number;
};

export type JapanPostSearchcodeRequest = {
  value: string;
  pageNumber: number;
  rowsPerPage: number;
  includeParenthesesTown?: boolean | null;
  includeBusinessAddresses?: boolean | null;
};

export type JapanPostAddresszipRequest = {
  freeword?: string | null;
  prefCode?: string | null;
  prefName?: string | null;
  prefKana?: string | null;
  prefRoma?: string | null;
  cityCode?: string | null;
  cityName?: string | null;
  cityKana?: string | null;
  cityRoma?: string | null;
  townName?: string | null;
  townKana?: string | null;
  townRoma?: string | null;
  pageNumber: number;
  rowsPerPage: number;
  includeCityDetails?: boolean | null;
  includePrefectureDetails?: boolean | null;
};

export type AddressAdapter = {
  getHealth(): Promise<HealthStatus>;
  searchcode(
    request: JapanPostSearchcodeRequest,
  ): Promise<MomoPagerData<JapanAddress>>;
  addresszip(
    request: JapanPostAddresszipRequest,
  ): Promise<MomoPagerData<JapanAddress>>;
};
