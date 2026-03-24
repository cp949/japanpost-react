# japanpost-react

[English](./README.md)

React + TypeScript 기반의 일본 우편번호/주소 검색 워크스페이스입니다.

이 저장소는 `pnpm workspace + turbo` 구조를 사용하며 다음 세 부분으로 나뉩니다.

- `packages/japanpost-react`: 배포되는 React hook 및 headless 입력 컴포넌트
- `apps/minimal-api`: 실제 업스트림 연동용 로컬 참고 서버
- `apps/demo`: end-to-end 확인용 Vite 데모 앱

## 권장 환경

- Node.js 20 이상
- pnpm 10 이상
- 저장소 스크립트 실행용 Linux 또는 WSL 환경의 Bash, `curl`, `ps`, `awk`, `setsid`
- 로컬 demo 전체 스택 확인 시 `.secrets/env` 파일

## 실행 방법

먼저 의존성을 설치합니다.

```bash
pnpm install
```

전체 로컬 스택을 한 번에 실행하려면:

```bash
pnpm demo:full
```

이 명령은 브라우저 데모와 `apps/minimal-api`를 함께 실행합니다. 루트의
`.secrets/env` 파일이 필요하며, `GET /health`가 HTTP `200`과
`{ "ok": true }`를 반환하고 그 응답이 방금 띄운 minimal-api 인스턴스에서 온
것까지 확인한 뒤에만 demo 앱을 시작합니다. 기본 포트는 API 서버 `8788`, demo
앱 `5173`입니다.

최소 `.secrets/env` 예시는 다음과 같습니다.

```bash
export JAPAN_POST_BASE_URL=...
export JAPAN_POST_CLIENT_ID=...
export JAPAN_POST_SECRET_KEY=...
```

`PORT`를 바꾸면 demo dev proxy도 그 포트를 자동으로 따라가며, 완전히 다른 대상을
쓰려면 `DEMO_API_PROXY_URL`로 명시적으로 override할 수 있습니다.

필요하면 각각 따로 실행할 수도 있습니다.

```bash
pnpm api:dev
pnpm demo:dev
```

실서버 연동 경로를 점검하려면:

```bash
pnpm api:check
```

이 명령은 실제 업스트림 자격증명이 들어 있는 `.secrets/env` 파일을 전제로
`apps/minimal-api`를 시작한 뒤 `/health`, `/q/japanpost/searchcode`,
`/q/japanpost/addresszip`를 순서대로 점검합니다.

저장소 전체 검증은 다음으로 실행합니다.

```bash
pnpm test
```

이 루트 진입점은 패키지 테스트, 생성된 패키지 README 동기화 검사, Linux/WSL
기준 `check-api.sh` / `dev-demo.sh` 셸 회귀 테스트와 두 진입점의
instance-readiness 검사까지 함께 실행합니다.

## 설치

```bash
pnpm add @cp949/japanpost-react
```

- 지원 React 버전: React 18, React 19
- 실제 배포 패키지 경로: [`packages/japanpost-react`](./packages/japanpost-react)
- 패키지 사용 문서: [`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md)

## Page-Aware Public Contract

배포 패키지 `@cp949/japanpost-react`의 공개 계약은 참고 `minimal-api`의
pager-aware high-level 계약과 정렬되어 있습니다.

- `JapanAddressDataSource.lookupPostalCode()`와 `.searchAddress()`는 모두
  `Promise<Page<JapanAddress>>`를 반환합니다.
- 훅 결과는 `Page<JapanAddress>` payload 자체를 그대로 노출합니다.
- `useJapanPostalCode`, `useJapanAddressSearch`, `useJapanAddress`는
  `data.elements`와 `data.totalElements`를 사용합니다.
- `Page<T>`는 `elements`, `totalElements`, `pageNumber`, `rowsPerPage`를
  유지합니다.

```ts
const addresses = data?.elements ?? [];
const total = data?.totalElements ?? 0;
```

## 추가 문서

- 내부 개발 및 API 연동 가이드: [`japanpost-development-guide.md`](./japanpost-development-guide.md)
- 운영용 Japan Post 연동 서버 가이드: [`minimal-api-production-guide.ko.md`](./minimal-api-production-guide.ko.md)
- demo 앱 소스: [`apps/demo`](./apps/demo)
- 로컬 참고 서버: [`apps/minimal-api`](./apps/minimal-api)
