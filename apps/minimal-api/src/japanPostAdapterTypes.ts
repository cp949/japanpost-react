/**
 * minimal-api가 외부에 노출하는 공개 타입 집합이다.
 * 데모 앱과 패키지 예제가 같은 계약을 바라보도록 이 파일에 고정해 둔다.
 */
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
  // readiness check 스크립트가 다른 서버 인스턴스를 오인하지 않도록 선택적으로 포함된다.
  instanceId?: string;
};

export type Page<T> = {
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
  // health는 프로세스 생존 여부가 아니라 "업스트림 호출 준비 완료 여부"를 뜻한다.
  getHealth(): Promise<HealthStatus>;
  searchcode(
    request: JapanPostSearchcodeRequest,
  ): Promise<Page<JapanAddress>>;
  addresszip(
    request: JapanPostAddresszipRequest,
  ): Promise<Page<JapanAddress>>;
};
