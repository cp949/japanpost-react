import {
  formatJapanAddressDisplay,
  formatJapanPostalCode,
} from "@cp949/japanpost-react";
import type { JapanAddress } from "@cp949/japanpost-react";
import { Box, Stack, TextField, Typography } from "@mui/material";

type SelectedAddressDetailsProps = {
  value: JapanAddress;
};

// API 응답에 줄바꿈이나 중복 공백이 섞여 있어도
// 상세 정보 패널에서는 한 줄 요약으로 읽기 쉽게 정리한다.
function formatSelectedAddressFieldValue(value: unknown): string {
  if (typeof value !== "string") {
    return String(value);
  }

  return value.replace(/\s+/g, " ").trim();
}

// 사용자가 결과 목록에서 고른 주소를
// 사람이 읽기 쉬운 형태와 원시 필드 목록 두 방식으로 함께 보여준다.
export function SelectedAddressDetails({
  value,
}: SelectedAddressDetailsProps) {
  // 디버깅이나 예제 확인이 쉽도록 객체의 각 필드를 `key=value` 형식으로 직렬화한다.
  const selectedAddressDetails = Object.entries(value)
    .map(
      ([name, fieldValue]) =>
        `${name}=${formatSelectedAddressFieldValue(fieldValue)}`,
    )
    .join("\n");

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1">Selected address</Typography>
      <TextField
        fullWidth
        label="Selected postal code"
        value={formatJapanPostalCode(value.postalCode)}
        slotProps={{
          htmlInput: {
            readOnly: true,
          },
        }}
      />
      <TextField
        fullWidth
        label="Selected address"
        value={formatJapanAddressDisplay(value)}
        slotProps={{
          htmlInput: {
            readOnly: true,
          },
        }}
      />
      <Stack spacing={1}>
        <Typography color="text.secondary" variant="body2">
          Selected fields
        </Typography>
        {/* pre 태그를 사용해 줄바꿈이 유지된 상태로 원시 필드 목록을 그대로 노출한다. */}
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 2,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "background.default",
            color: "text.primary",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {selectedAddressDetails}
        </Box>
      </Stack>
    </Stack>
  );
}
