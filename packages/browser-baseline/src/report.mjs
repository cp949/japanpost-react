/**
 * 검사 결과를 사람이 읽을 줄 목록으로 바꾼다.
 *
 * 순수 함수다. 파일도 읽지 않고, 출력도 하지 않고, 종료하지도 않는다.
 * 어느 스트림에 찍을지와 종료 코드는 결과의 ok를 보고 호출부가 정한다.
 * 표시를 판정에서 갈라 둬야 문구를 실행 없이 검증할 수 있다.
 *
 * 기준선 값은 전부 인자로 받은 baseline에서 흐른다.
 * 이 module은 Chrome 버전도 esbuild 타깃도 알지 못한다.
 */

/** 같은 파일의 판정을 한 묶음으로 모은다. 첫 등장 순서를 유지한다. */
function groupByFile(findings) {
  const groups = new Map();

  for (const finding of findings) {
    const group = groups.get(finding.file);

    if (group === undefined) {
      groups.set(finding.file, [finding]);
      continue;
    }

    group.push(finding);
  }

  return groups;
}

/** 문법 위반 하나를 줄 목록으로 편다. */
function formatSyntax(finding, syntaxTargetLabel, syntaxTargetFlag, lines) {
  lines.push(
    `[syntax] ${finding.file}: ${syntaxTargetLabel}를 초과하는 문법이 남아 있다.`,
  );

  // line 0은 불일치 위치를 특정하지 못했다는 뜻이다. 짝이 없는 원문을 보이면
  // 엉뚱한 줄을 고치게 되므로 진단 줄을 통째로 뺀다.
  if (finding.line > 0) {
    lines.push(`  첫 불일치 line ${finding.line}`);
    lines.push(`    현재:   ${finding.actual.trim()}`);
    lines.push(`    ${syntaxTargetLabel}: ${finding.lowered.trim()}`);
  }

  lines.push("  전체 범위는 다음으로 확인한다:");
  lines.push(
    `    npx esbuild ${finding.file} --target=esnext --format=esm > /tmp/modern.js`,
  );
  lines.push(
    `    npx esbuild ${finding.file} --target=${syntaxTargetFlag} --format=esm > /tmp/legacy.js && diff /tmp/modern.js /tmp/legacy.js`,
  );
}

/** 한 파일의 API 위반을 한 묶음으로 편다. */
function formatApi(file, apiFindings, runtimeBaseline, lines) {
  lines.push(
    `[api] ${file}: ${runtimeBaseline} 미지원 API ${apiFindings.length}건`,
  );

  // originNote는 소스맵 자체를 못 쓴다는 뜻이고, 같은 파일의 모든 finding이
  // 같은 값을 갖는다(check.mjs가 파일당 한 번만 판정한다). 그룹 머리 바로
  // 아래 한 줄로 사유를 내고, 개별 위반 줄의 ← 표기는 생략한다 — 이미 한 번
  // 말한 사유를 줄마다 반복하면 잡음이다.
  const originNote = apiFindings[0].originNote;

  if (originNote !== null) {
    lines.push(`  원본 매핑 없음 — ${originNote}`);
  }

  for (const finding of apiFindings) {
    // Infinity는 Chrome이 아직 이 API를 출시하지 않았다는 뜻이다.
    // "Chrome Infinity+"로 찍으면 오타처럼 보이므로 별도로 표기한다.
    const chromeLabel = Number.isFinite(finding.chrome)
      ? `Chrome ${finding.chrome}+`
      : "Chrome 미지원";

    // 맵을 쓸 수 있을 때만 줄 단위 원인을 붙인다. origin이 null이면 그 줄만
    // 매핑이 없다는 뜻이므로 "(매핑 없음)"으로 명시한다 — 조용히 생략하면
    // 다른 위반과 구분되지 않는다.
    const originSuffix =
      originNote === null
        ? finding.origin !== null
          ? `  ← ${finding.origin}`
          : "  ← (매핑 없음)"
        : "";

    lines.push(
      `  line ${finding.line}: ${finding.name} (${chromeLabel}, tier ${finding.tier})${originSuffix}`,
    );
    lines.push(`    ${finding.text}`);
  }

  // tier 2는 수신자 타입을 정적으로 모르는 판정이라 오탐일 수 있다.
  // 해소 경로를 함께 안내한다.
  if (apiFindings.some((finding) => finding.tier === 2)) {
    lines.push(
      "  tier 2는 수신자 타입을 모르는 판정이다. 오탐이면 package.json의 browserBaseline.allow에 file·name·reason을 추가한다.",
    );
  }
}

const DEPENDENCY_REASONS = {
  "dependency-leak": "번들되어야 할 dependency가 외부 import로 남았다.",
  "optional-dependency-leak": "optionalDependency가 외부 import로 남았다.",
  "undeclared-runtime": "package.json에 선언되지 않은 runtime dependency다.",
  "node-builtin": "브라우저 dist가 Node 내장 모듈을 참조한다.",
  "computed-specifier":
    "계산형 specifier는 dependency closure를 판정할 수 없다.",
};

/** 한 파일의 dependency closure 위반을 한 묶음으로 편다. */
function formatDependency(file, dependencyFindings, lines) {
  lines.push(
    `[dependency] ${file}: dependency closure 위반 ${dependencyFindings.length}건`,
  );

  for (const finding of dependencyFindings) {
    const target =
      finding.specifier === null
        ? "계산형 specifier"
        : `${finding.specifier} -> ${finding.packageRoot ?? "package root 판정 불가"}`;

    lines.push(
      `  line ${finding.line}: ${target} (${DEPENDENCY_REASONS[finding.issue]})`,
    );
    lines.push(`    ${finding.text}`);
  }
}

/**
 * 검사 결과를 줄 목록으로 만든다. 빈 문자열은 빈 줄이다.
 *
 * 판정은 다시 계산하지 않는다. 마지막 줄이 통과인지 실패인지는 ok가 정한다.
 *
 * @param {{ baseline: object, findings: object[], ok: boolean }} result
 *   checkPackageBaseline의 반환값을 그대로 넘길 수 있다
 * @returns {string[]}
 */
export function formatReport({ baseline, findings, ok }) {
  const syntaxTargetLabel = baseline.esbuildTarget.join(", ");
  // 안내 명령에 그대로 붙여 넣을 값이다. --target은 공백을 받지 않는다.
  const syntaxTargetFlag = baseline.esbuildTarget.join(",");
  const runtimeBaseline = `Chrome ${baseline.minChrome}`;
  const lines = [];

  // 진단은 파일 단위로 읽힌다. 판정 종류가 아니라 파일로 먼저 묶는다.
  for (const [file, group] of groupByFile(findings)) {
    for (const finding of group) {
      if (finding.kind === "syntax") {
        formatSyntax(finding, syntaxTargetLabel, syntaxTargetFlag, lines);
      }
    }

    const apiFindings = group.filter((finding) => finding.kind === "api");

    if (apiFindings.length > 0) {
      formatApi(file, apiFindings, runtimeBaseline, lines);
    }

    const dependencyFindings = group.filter(
      (finding) => finding.kind === "dependency",
    );

    if (dependencyFindings.length > 0) {
      formatDependency(file, dependencyFindings, lines);
    }

    for (const finding of group) {
      if (finding.kind === "error") {
        lines.push(`[error] ${file}: ${finding.message}`);
      }
    }
  }

  if (ok) {
    lines.push(
      `browser compat check 통과: 문법 ${syntaxTargetLabel}, 런타임 API ${runtimeBaseline}, dependency closure (browserslist ${JSON.stringify(baseline.query)}).`,
    );

    return lines;
  }

  lines.push("");
  lines.push(
    `browser compat check 실패: 계약은 ${JSON.stringify(baseline.query)}, 문법은 ${syntaxTargetLabel}, 런타임 API는 ${runtimeBaseline}, dependency closure는 peer/self-only 기준이다.`,
  );

  return lines;
}
