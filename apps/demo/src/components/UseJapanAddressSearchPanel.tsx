import {
  formatJapanPostalCode,
  useJapanAddressSearch,
  type JapanAddress,
  type JapanAddressSearchInput,
} from "@cp949/japanpost-react";
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

type UseJapanAddressSearchPanelProps = {
  demoApiBaseUrl: string;
};

type SearchFormState = {
  addressQuery: string;
  prefName: string;
  cityName: string;
  townName: string;
  pageNumber: string;
  rowsPerPage: string;
  debounceMs: string;
  includeCityDetails: boolean;
  includePrefectureDetails: boolean;
};

const DEFAULT_FORM_STATE: SearchFormState = {
  addressQuery: "",
  prefName: "",
  cityName: "",
  townName: "",
  pageNumber: "0",
  rowsPerPage: "10",
  debounceMs: "0",
  includeCityDetails: false,
  includePrefectureDetails: false,
};

function normalizeText(value: string) {
  // 빈 문자열은 검색 조건에서 제외하기 위해 `undefined` 로 바꾼다.
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseNonNegativeInteger(value: string, fallback: number) {
  // 숫자 입력이 비어 있거나 잘못되었을 때도
  // 훅이 항상 안전한 기본값을 받도록 보정한다.
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function buildSearchRequest(form: SearchFormState): Exclude<
  JapanAddressSearchInput,
  string
> {
  // 사용자가 입력하지 않은 조건은 요청 객체에서 제거해
  // 서버가 의미 없는 빈 문자열 필드를 받지 않게 한다.
  return {
    ...(normalizeText(form.addressQuery) === undefined
      ? {}
      : { addressQuery: normalizeText(form.addressQuery) }),
    ...(normalizeText(form.prefName) === undefined
      ? {}
      : { prefName: normalizeText(form.prefName) }),
    ...(normalizeText(form.cityName) === undefined
      ? {}
      : { cityName: normalizeText(form.cityName) }),
    ...(normalizeText(form.townName) === undefined
      ? {}
      : { townName: normalizeText(form.townName) }),
    pageNumber: parseNonNegativeInteger(form.pageNumber, 0),
    rowsPerPage: parseNonNegativeInteger(form.rowsPerPage, 10),
    includeCityDetails: form.includeCityDetails,
    includePrefectureDetails: form.includePrefectureDetails,
  };
}

// `useJapanAddressSearch()` 훅에 구조화된 주소 검색 조건을 직접 넘겨 보는 패널이다.
export function UseJapanAddressSearchPanel({
  demoApiBaseUrl,
}: UseJapanAddressSearchPanelProps) {
  // dataSource 생성을 메모이즈해 폼 상태 변경만으로 훅이 리셋되지 않게 한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const [form, setForm] = useState(DEFAULT_FORM_STATE);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<JapanAddress | null>(
    null,
  );
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<
    Exclude<JapanAddressSearchInput, string> | null
  >(null);
  // 디바운스 값도 문자열 입력이므로 실제 훅에 넣기 전 숫자로 정규화한다.
  const debounceMs = parseNonNegativeInteger(form.debounceMs, 0);
  const searchState = useJapanAddressSearch({
    dataSource,
    debounceMs,
  });
  const results = searchState.data?.elements ?? [];

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
    // 검색 데모를 처음 열었을 때 상태로 완전히 되돌린다.
    setForm(DEFAULT_FORM_STATE);
    setHasSubmitted(false);
    setSelectedAddress(null);
    setLastSubmittedRequest(null);
    searchState.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // 마지막 실제 제출 요청을 따로 저장해 미리보기 패널에서 추적할 수 있게 한다.
    const request = buildSearchRequest(form);

    setHasSubmitted(true);
    setLastSubmittedRequest(request);
    await searchState.search(request);
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6">useJapanAddressSearch()</Typography>
        <Typography color="text.secondary" variant="body2">
          Submit structured fields directly to the hook and inspect the request
          preview inline.
        </Typography>
      </Stack>

      <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit}>
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Address query"
              value={form.addressQuery}
              onChange={(event) =>
                updateField("addressQuery", event.target.value)
              }
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Prefecture name"
              value={form.prefName}
              onChange={(event) => updateField("prefName", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="City name"
              value={form.cityName}
              onChange={(event) => updateField("cityName", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              fullWidth
              label="Town name"
              value={form.townName}
              onChange={(event) => updateField("townName", event.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
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
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              fullWidth
              label="Debounce (ms)"
              type="number"
              value={form.debounceMs}
              onChange={(event) =>
                updateField("debounceMs", event.target.value)
              }
              slotProps={{
                htmlInput: {
                  min: 0,
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.includeCityDetails}
                  onChange={(event) =>
                    updateField("includeCityDetails", event.target.checked)
                  }
                />
              }
              label="Include city details"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={form.includePrefectureDetails}
                  onChange={(event) =>
                    updateField(
                      "includePrefectureDetails",
                      event.target.checked,
                    )
                  }
                />
              }
              label="Include prefecture details"
            />
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
          <Button loading={searchState.loading} type="submit" variant="contained">
            Search
          </Button>
          <Button type="button" variant="outlined" onClick={handleReset}>
            Reset
          </Button>
        </Box>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">Normalized request</Typography>
        {/* 아직 검색 전이면 현재 debounce 설정만 보여 주고,
            검색 후에는 실제 제출된 요청과 함께 렌더링한다. */}
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
          {JSON.stringify(
            lastSubmittedRequest === null
              ? {
                  debounceMs,
                }
              : {
                  debounceMs,
                  ...lastSubmittedRequest,
                },
            null,
            2,
          )}
        </Box>
      </Stack>

      {searchState.error ? (
        <Alert severity="error">{searchState.error.message}</Alert>
      ) : null}

      {!searchState.loading &&
      !searchState.error &&
      hasSubmitted &&
      results.length === 0 ? (
        <Alert severity="info">No results found.</Alert>
      ) : null}

      {!searchState.loading && !searchState.error && results.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography color="text.secondary" variant="body2">
            {searchState.data?.totalElements ?? results.length} result(s) on page{" "}
            {(searchState.data?.pageNumber ?? 0) + 1}
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
                {/* 선택 결과는 별도 상세 패널로 내려 보내고,
                    목록에서는 핵심 정보만 빠르게 스캔할 수 있게 유지한다. */}
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
