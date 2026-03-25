# japanpost-react

[English](./README.md)

React + TypeScript 기반의 일본 우편번호/주소 검색 워크스페이스입니다.

이 저장소는 `pnpm workspace + turbo` 구조를 사용하며 다음 세 부분으로 나뉩니다.

- `packages/japanpost-react`: 배포되는 React hook 및 headless 입력 컴포넌트
- `apps/minimal-api`: 로컬 sample server이자 demo 연동 helper
- `apps/demo`: MUI 기반 end-to-end 확인용 Vite 데모 앱

## 권장 환경

- Node.js 20 이상
- pnpm 10 이상
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
`.secrets/env` 파일이 필요하며, 이 스크립트들은 해당 파일을 직접 읽기 때문에
현재 셸에서만 `export`한 값만으로는 충분하지 않습니다. 다만 같은 키가 셸 env와
파일에 모두 있으면 셸 env가 우선하고 `.secrets/env`는 fallback으로만 사용됩니다.
`GET /health`가 HTTP `200`과 `{ "ok": true }`를 반환하고 그 응답이 방금 띄운
minimal-api 인스턴스에서 온 것까지 확인한 뒤에만 demo 앱을 시작합니다. 기본
포트는 API 서버 `8788`, demo 앱 `5173`입니다.

최소 `.secrets/env` 예시는 다음과 같습니다.

```bash
mkdir -p .secrets
cat > .secrets/env <<'EOF'
export JAPANPOST_CLIENT_ID=...
export JAPANPOST_SECRET_KEY=...
# Optional:
# export JAPANPOST_BASE_URL=...
EOF
```

`PORT`를 바꾸면 demo dev proxy도 그 포트를 자동으로 따라가며, 완전히 다른 대상을
쓰려면 `DEMO_API_PROXY_URL`로 명시적으로 override할 수 있습니다.

필요하면 각각 따로 실행할 수도 있습니다.

```bash
pnpm api:dev
pnpm demo:dev
```

`pnpm api:dev`는 셸 env만으로도 실행할 수 있고, 빠진 값이 있으면 `.secrets/env`
에서 fallback으로 채웁니다.

실서버 연동 경로를 점검하려면:

```bash
pnpm api:check
```

이 명령은 실제 업스트림 자격증명이 들어 있는 `.secrets/env` 파일을 전제로
`apps/minimal-api`를 시작한 뒤 `/health`, `/q/japanpost/searchcode`,
`/q/japanpost/addresszip`를 순서대로 점검합니다. 같은 키가 셸 env와 파일에 모두
있으면 셸 env가 우선합니다.

저장소 전체 검증은 다음으로 실행합니다.

```bash
pnpm test
```

이 루트 진입점은 생성된 패키지 README 동기화 검사, 패키지 unit test,
workspace integration test를 함께 실행하는 빠른 기본 검증 경로입니다.

`pnpm test`는 Node 기반 진입점이라 Windows native
셸에서도 바로 실행할 수 있습니다. `pnpm demo:full`과 `pnpm api:check`도 같은
방식이라 Bash가 꼭 필요하지 않습니다.
직접 `scripts/*.sh`를 실행하는 경로만 Bash/Linux/WSL 전제를 유지합니다.

## 설치

```bash
pnpm add @cp949/japanpost-react
```

- 지원 React 버전: React 18, React 19
- 실제 배포 패키지 경로: [`packages/japanpost-react`](./packages/japanpost-react)
- 패키지 사용 문서: [`packages/japanpost-react/README.md`](./packages/japanpost-react/README.md)

## Demo 앱 예제

`apps/demo`는 라이브러리 연결 방식을 가장 빨리 파악할 수 있는 참고 앱입니다.
`pnpm demo:full`로 실행하면 다음 예제를 바로 확인할 수 있습니다.

- `Dialog`: `JapanPostalAddressField`를 중심으로 한 검색 버튼 + 모달 흐름
- `Embedded`: 같은 조회 흐름을 페이지 안에 직접 넣은 임베디드 예제
- `useJapanAddressSearch()`: 주소 검색 훅의 요청/결과 처리를 보여주는 예제
- `useJapanPostalCode()`: 우편번호 검색 훅 예제
- `useJapanAddress()`: 우편번호 검색과 주소 검색을 하나의 훅으로 다루는 통합 예제

## Page-Aware Public Contract

배포 패키지 `@cp949/japanpost-react`의 공개 계약은 로컬 `minimal-api`
sample server와 같은 pager-aware 계약과 정렬되어 있습니다.

- `JapanAddressDataSource.lookupPostalCode()`와 `.searchAddress()`는 모두
  `Promise<Page<JapanAddress>>`를 반환합니다.
- 훅 결과는 `Page<JapanAddress>` payload 자체를 그대로 노출합니다.
- `useJapanPostalCode`, `useJapanAddressSearch`, `useJapanAddress`는
  `data.elements`와 `data.totalElements`를 사용합니다.
- `Page<T>`는 `elements`, `totalElements`, `pageNumber`, `rowsPerPage`를
  유지합니다.
- backend에서 공유 요청/응답 타입만 가져오고 싶다면 루트 엔트리에서
  `import type`으로 가져오면 됩니다.

이 변경은 이전의 세 엔트리 표면에서 갈라진 breaking change입니다. 전용
`./contracts` 서브패스는 제거되었습니다.

## 공개 엔트리 정책

- `@cp949/japanpost-react`: 훅, headless 입력 컴포넌트, 유틸리티, 공개 타입을
  위한 기본 엔트리
- `@cp949/japanpost-react/client`: Next.js App Router client component용
  엔트리
루트 엔트리에서 요청/응답/페이지 타입도 함께 `import type`으로 가져오세요.
JavaScript 소비자는 runtime helpers를 root나 client 엔트리에서만 사용하면 됩니다.

```ts
const addresses = data?.elements ?? [];
const total = data?.totalElements ?? 0;
```

## 추가 문서

- sample server 기반 연동 계약 메모: [`minimal-api-sample-server-guide.ko.md`](./minimal-api-sample-server-guide.ko.md)
- demo 앱 소스: [`apps/demo`](./apps/demo)
- 로컬 sample server: [`apps/minimal-api`](./apps/minimal-api)

`apps/demo`는 로컬 개발 중 `@cp949/japanpost-react`와
`@cp949/japanpost-react/client`를 `packages/japanpost-react/src/*`에 직접
연결합니다. `pnpm test:workspace`는 이 권장 import들이 계속 실제
demo/workspace 경로에서 소비되는지 함께 검증합니다.

## Sample Server 메모

- `apps/minimal-api`는 `apps/demo`와 `api:check`를 위한 로컬 sample server라서
  고정된 permissive CORS 응답만 유지합니다.
- `apps/minimal-api`의 새 코드도 공유 계약 타입은 루트 엔트리에서
  `import type`으로 가져오는 쪽을 우선합니다.
- 실제 운영 백엔드에서 필요한 CORS, 인증, 로깅, rate limiting 정책은 이 샘플
  서버 범위 밖에서 별도로 설계해야 합니다.
