import {
  formatJapanAddressDisplay,
  formatJapanPostalCode,
} from "@cp949/japanpost-react";
import type { JapanAddress } from "@cp949/japanpost-react";
import { Button, Stack, TextField } from "@mui/material";
import { useState } from "react";

import { JapanAddressSearchDialog } from "./JapanAddressSearchDialog";

type JapanPostalAddressFieldProps = {
  demoApiBaseUrl: string;
  value: JapanAddress;
  onSelectAddress: (address: JapanAddress) => void;
};

// 선택된 우편번호/주소를 읽기 전용 필드로 보여주고,
// 상세 검색은 별도 다이얼로그로 위임하는 가장 단순한 통합 예제다.
export function JapanPostalAddressField({
  demoApiBaseUrl,
  value,
  onSelectAddress,
}: JapanPostalAddressFieldProps) {
  // 다이얼로그 열림 상태만 이 컴포넌트가 직접 관리하고,
  // 실제 주소 선택 결과는 부모가 소유한 상태로 다시 올려 보낸다.
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  function openDialog() {
    setIsDialogOpen(true);
  }

  function closeDialog() {
    setIsDialogOpen(false);
  }

  return (
    <Stack spacing={3}>
      {/* 사용자가 직접 수정하지 않고 현재 선택값만 확인하도록 읽기 전용으로 렌더링한다. */}
      <TextField
        fullWidth
        label="Postal code"
        value={formatJapanPostalCode(value.postalCode)}
        slotProps={{
          htmlInput: {
            readOnly: true,
          },
        }}
      />

      {/* 주소 문자열은 라이브러리 응답의 원본 포맷을 정리한 뒤 표시한다. */}
      <TextField
        fullWidth
        label="Address"
        value={formatJapanAddressDisplay(value)}
        slotProps={{
          htmlInput: {
            readOnly: true,
          },
        }}
      />

      <Button variant="contained" onClick={openDialog}>
        Search address
      </Button>

      {/* 검색 UI 자체는 별도 컴포넌트로 분리해 재사용성과 책임 분리를 유지한다. */}
      <JapanAddressSearchDialog
        demoApiBaseUrl={demoApiBaseUrl}
        open={isDialogOpen}
        onRequestClose={closeDialog}
        onSelectAddress={onSelectAddress}
      />
    </Stack>
  );
}
