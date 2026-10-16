# @cp949/japanpost-react 배포

이 문서는 `@cp949/japanpost-react`를 npm에 배포하는 유지보수자용 절차다. 배포는 [release-it](https://github.com/release-it/release-it)으로 진행한다.

위험도: 높음

롤백: npm에 배포된 동일 버전은 덮어쓰지 않는다. 문제가 있으면 다음 patch 버전으로 교정한다. 원격 태그 삭제는 가능하지만 별도의 위험 작업이다.

> release-it은 유지보수자가 터미널에서 직접 실행한다. 에이전트는 실행하지 않는다.

## 전제 조건

- 루트에서 Node.js `>=24.18`과 pnpm `10.32.1`을 사용한다.
- npm registry, 로그인, `@cp949` scope 배포 권한을 확인한다.
- 배포 대상 코드를 커밋하고 작업 트리를 깨끗하게 유지한다. release-it이 dirty working tree에서 중단한다.
- 현재 branch에 upstream이 있고 `origin` push 권한이 있어야 한다.
- 루트 `CHANGELOG.md`의 `## [Unreleased]` 아래에 이번 배포 항목을 적는다. 비어 있으면 release-it이 중단한다.
- 패키지 README(`packages/japanpost-react/README*.md`)는 `pnpm readme:package`로 미리 생성해 커밋한다. 생성본이 원본과 다르면 검증 단계에서 중단한다.

```sh
npm config get registry
npm whoami
git status --short
```

## 배포

루트에서 실행한다.

```sh
# 실제 변경 없이 흐름만 확인
pnpm release-it --dry-run

# 배포
pnpm release-it
```

`pnpm release-it`은 `packages/japanpost-react`로 이동해 release-it을 실행한다. 추가 인자는 그대로 전달된다(예: `pnpm release-it patch`, `pnpm release-it minor`).

release-it이 수행하는 순서:

1. `before:init` hook — 루트에서 `readme:package:check`, `lint`, `check-types`, `test`, `build --force`를 차례로 실행한다. 하나라도 실패하면 중단한다.
2. 버전 선택 프롬프트 → `packages/japanpost-react/package.json`의 `version`을 올린다.
3. 루트 `CHANGELOG.md`의 `[Unreleased]` 항목을 `[<version>] - <날짜>` 섹션으로 옮기고, 빈 `[Unreleased]`를 다시 둔다.
4. 변경 파일을 stage한다. `packages/japanpost-react` 범위는 `git add . --update`로, 루트 `CHANGELOG.md`는 `after:bump` hook이 stage한다.
5. `pnpm publish . --tag <dist-tag> --access public --no-git-checks`(일반 버전은 `latest`) — `prepublishOnly`가 `dist`를 다시 빌드한다. 2FA가 켜져 있으면 pnpm이 OTP 입력(또는 web 인증)을 요청한다.
   - `--no-git-checks`가 필요한 이유: 이 시점에는 bump 변경이 stage만 된 상태이고, pnpm의 기본 배포 branch 검사가 `main` 외 branch 배포를 막는다.
6. `chore: @cp949/japanpost-react v<version> 배포` 커밋, annotated tag `v<version>` 생성, `origin`에 push(`--follow-tags`).

publish가 git commit·tag보다 먼저 실행된다(release-it 21 lifecycle).

각 단계 전에 release-it이 확인 프롬프트를 띄운다. GitHub Release는 만들지 않는다.

설정 파일: [`packages/japanpost-react/.release-it.json`](packages/japanpost-react/.release-it.json)

## 실패 후 조치

release-it은 push 성공 전에 종료되면(에러, Ctrl+C) 로컬 변경을 자동 rollback한다: 만든 태그를 지우고 `git reset --hard`(커밋했으면 `HEAD~1`)로 되돌린다. 작업 트리가 깨끗한 상태에서만 시작하므로 사용자 변경은 사라지지 않는다.

- **publish 전에 중단 / publish 실패, registry에 해당 버전 없음**: 자동 rollback된다. 원인을 해결하고 `pnpm release-it`을 다시 실행한다.
- **registry에 해당 버전이 이미 존재**: 제거하거나 덮어쓰지 말고 다음 patch 버전으로 교정한다.
- **publish 성공 후 push 실패**: release-it이 rollback을 끄고 `The package might have been released, but git push failed.`를 출력한다. 로컬 커밋·태그가 남아 있으므로 `git push --follow-tags`로 재시도한다.
- **publish 성공 후 commit·tag 단계에서 중단**: 자동 rollback이 bump 변경을 지운다. registry에는 이미 배포됐으므로 되돌리지 말고 `git status`와 `npm view @cp949/japanpost-react version`을 확인한 뒤 bump 커밋·태그를 수동으로 만든다.

  ```sh
  cd packages/japanpost-react
  npm version <version> --no-git-tag-version   # bump가 rollback된 경우
  # 루트 CHANGELOG.md의 [Unreleased]를 [<version>] - <날짜>로 수동 정리
  git commit -am "chore: @cp949/japanpost-react v<version> 배포"
  git tag -a v<version> -m "@cp949/japanpost-react v<version>"
  git push --follow-tags
  ```
