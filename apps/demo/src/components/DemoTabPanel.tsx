import { Box } from "@mui/material";
import type { ReactNode } from "react";

type DemoTabPanelProps = {
  children: ReactNode;
  id: string;
  labelledBy: string;
  value: string;
  when: string;
};

// MUI Tabs 와 짝을 이루는 단순한 탭 패널 래퍼다.
// 현재 활성 탭과 자신이 담당하는 탭 값을 비교해 보이기/숨기기를 제어한다.
export function DemoTabPanel({
  children,
  id,
  labelledBy,
  value,
  when,
}: DemoTabPanelProps) {
  // 비활성 패널도 DOM에는 남겨 두어 탭 전환 시 레이아웃이 안정적으로 유지되게 한다.
  const hidden = value !== when;

  return (
    <Box
      // 스크린 리더가 어떤 탭이 이 패널을 설명하는지 연결할 수 있게 한다.
      aria-labelledby={labelledBy}
      hidden={hidden}
      id={id}
      role="tabpanel"
      sx={{ pt: 1 }}
    >
      {children}
    </Box>
  );
}
