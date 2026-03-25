import {
  formatJapanPostalCode,
  normalizeJapanPostalCode,
  type JapanPostalCodeSearchInput,
} from "@cp949/japanpost-react";
import { useJapanPostalCode } from "@cp949/japanpost-react/client";
import type { JapanAddress } from "@cp949/japanpost-react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  List,
  ListItemButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState, type FormEvent } from "react";

import { createDemoApiDataSource } from "../demoApi";
import {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "./japanAddressDisplay";
import { SelectedAddressDetails } from "./SelectedAddressDetails";

type UseJapanPostalCodePanelProps = {
  demoApiBaseUrl: string;
};

type SearchFormState = {
  postalCode: string;
  pageNumber: string;
  rowsPerPage: string;
  includeParenthesesTown: boolean;
};

const DEFAULT_FORM_STATE: SearchFormState = {
  postalCode: "",
  pageNumber: "0",
  rowsPerPage: "10",
  includeParenthesesTown: false,
};

function parseNonNegativeInteger(value: string, fallback: number) {
  // 숫자 입력 필드는 문자열로 들어오므로,
  // 훅에 전달하기 전에 음수가 아닌 정수만 허용하도록 정규화한다.
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function buildSearchRequest(form: SearchFormState): Exclude<
  JapanPostalCodeSearchInput,
  string
> {
  // 화면 입력 상태를 훅이 기대하는 검색 요청 객체 형태로 변환한다.
  return {
    postalCode: normalizeJapanPostalCode(form.postalCode),
    pageNumber: parseNonNegativeInteger(form.pageNumber, 0),
    rowsPerPage: parseNonNegativeInteger(form.rowsPerPage, 10),
    includeParenthesesTown: form.includeParenthesesTown,
  };
}

// `useJapanPostalCode()` 훅에 우편번호 검색 옵션을 직접 전달해 보는 예제다.
export function UseJapanPostalCodePanel({
  demoApiBaseUrl,
}: UseJapanPostalCodePanelProps) {
  // 같은 base URL 이 유지되는 동안 훅이 사용할 dataSource 인스턴스를 재사용한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const postalCodeState = useJapanPostalCode({ dataSource });
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<JapanAddress | null>(
    null,
  );
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<
    Exclude<JapanPostalCodeSearchInput, string> | null
  >(null);
  // 제출 전에도 어떤 요청이 나갈지 볼 수 있도록 현재 입력값 기반의 draft 요청을 계산한다.
  const normalizedDraftRequest = buildSearchRequest(form);
  const results = postalCodeState.data?.elements ?? [];

  function updateField<K extends keyof SearchFormState>(
    field: K,
    value: SearchFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleReset() {
    // 폼, 선택 결과, 마지막 요청, 훅 내부 상태를 한 번에 초기화한다.
    setForm(DEFAULT_FORM_STATE);
    setHasSubmitted(false);
    setSelectedAddress(null);
    setLastSubmittedRequest(null);
    postalCodeState.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 제출 시점의 정규화된 요청을 별도로 저장해
    // 이후 입력을 계속 바꿔도 "마지막 실제 요청" 을 구분해서 보여줄 수 있게 한다.
    const request = buildSearchRequest(form);

    setHasSubmitted(true);
    setLastSubmittedRequest(request);
    await postalCodeState.search(request);
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6">useJapanPostalCode()</Typography>
        <Typography color="text.secondary" variant="body2">
          Submit postal-code lookup options directly to the hook and inspect the
          request preview inline.
        </Typography>
      </Stack>

      <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Postal code"
              value={form.postalCode}
              helperText="Use 3-7 digits. Hyphen is optional."
              onChange={(event) => updateField("postalCode", event.target.value)}
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Page number"
              type="number"
              value={form.pageNumber}
              helperText="Zero-based page index."
              onChange={(event) =>
                updateField("pageNumber", event.target.value)
              }
              slotProps={{
                htmlInput: {
                  min: 0,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 3 }}>
            <TextField
              fullWidth
              label="Rows per page"
              type="number"
              value={form.rowsPerPage}
              onChange={(event) =>
                updateField("rowsPerPage", event.target.value)
              }
              slotProps={{
                htmlInput: {
                  min: 1,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.includeParenthesesTown}
                  onChange={(event) =>
                    updateField("includeParenthesesTown", event.target.checked)
                  }
                />
              }
              label="Include parentheses town"
            />
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
          <Button
            disabled={normalizedDraftRequest.postalCode.length === 0}
            loading={postalCodeState.loading}
            type="submit"
            variant="contained"
          >
            Search
          </Button>
          <Button type="button" variant="outlined" onClick={handleReset}>
            Reset
          </Button>
        </Box>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">Normalized request</Typography>
        {/* 마지막 제출값이 있으면 그것을, 없으면 현재 draft 요청을 보여 줘
            사용자가 normalize 결과를 즉시 확인할 수 있게 한다. */}
        <Box
          component="pre"
          sx={{
            m: 0,
            overflowX: "auto",
            p: 2,
            border: 1,
            borderColor: "divider",
            borderRadius: 1,
            bgcolor: "grey.50",
            fontFamily: "monospace",
            fontSize: 14,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {JSON.stringify(lastSubmittedRequest ?? normalizedDraftRequest, null, 2)}
        </Box>
      </Stack>

      {postalCodeState.error ? (
        <Alert severity="error">{postalCodeState.error.message}</Alert>
      ) : null}

      {!postalCodeState.loading &&
      !postalCodeState.error &&
      hasSubmitted &&
      results.length === 0 ? (
        <Alert severity="info">No results found.</Alert>
      ) : null}

      {!postalCodeState.loading &&
      !postalCodeState.error &&
      results.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography color="text.secondary" variant="body2">
            {postalCodeState.data?.totalElements ?? results.length} result(s) on
            page {(postalCodeState.data?.pageNumber ?? 0) + 1}
          </Typography>
          <List disablePadding>
            {results.map((result) => (
              <ListItemButton
                key={[
                  result.provider,
                  result.postalCode,
                  result.prefecture,
                  result.city,
                  result.town,
                  result.address,
                ].join("|")}
                aria-label={formatJapanAddressSearchResultLabel(result)}
                onClick={() => setSelectedAddress(result)}
              >
                {/* 여러 결과가 반환될 수 있으므로, 항목 선택 시 하단 상세 패널을 갱신한다. */}
                <Stack alignItems="flex-start" spacing={0.25}>
                  <Typography color="text.secondary" variant="body2">
                    {formatJapanPostalCode(result.postalCode)}
                  </Typography>
                  <Typography>{formatJapanAddressDisplay(result)}</Typography>
                </Stack>
              </ListItemButton>
            ))}
          </List>
          {selectedAddress ? (
            <SelectedAddressDetails value={selectedAddress} />
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}
