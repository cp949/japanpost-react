import {
  formatJapanPostalCode,
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
  normalizeJapanPostalCode,
  type JapanAddressSearchInput,
  type JapanPostalCodeSearchInput,
} from "@cp949/japanpost-react";
import { useJapanAddress } from "@cp949/japanpost-react/client";
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
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState, type FormEvent } from "react";

import { createDemoApiDataSource } from "../demoApi";
import { SelectedAddressDetails } from "./SelectedAddressDetails";

type UseJapanAddressPanelProps = {
  demoApiBaseUrl: string;
};

type SearchMode = "postal-code" | "address-query";

type PostalCodeFormState = {
  postalCode: string;
  pageNumber: string;
  rowsPerPage: string;
  includeParenthesesTown: boolean;
};

type AddressQueryFormState = {
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

const DEFAULT_MODE: SearchMode = "postal-code";

const DEFAULT_POSTAL_CODE_FORM: PostalCodeFormState = {
  postalCode: "",
  pageNumber: "0",
  rowsPerPage: "10",
  includeParenthesesTown: false,
};

const DEFAULT_ADDRESS_QUERY_FORM: AddressQueryFormState = {
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
  // 주소 검색의 빈 문자열 조건은 의미가 없으므로 undefined 로 치환한다.
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function parseNonNegativeInteger(value: string, fallback: number) {
  // 폼 입력 문자열을 훅 요청용 숫자로 바꾸되,
  // 잘못된 값이 들어오면 안전한 기본값으로 되돌린다.
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function buildPostalCodeRequest(form: PostalCodeFormState): Exclude<
  JapanPostalCodeSearchInput,
  string
> {
  // 우편번호 모드 폼을 `searchByPostalCode()` 가 받는 요청 구조로 변환한다.
  return {
    postalCode: normalizeJapanPostalCode(form.postalCode),
    pageNumber: parseNonNegativeInteger(form.pageNumber, 0),
    rowsPerPage: parseNonNegativeInteger(form.rowsPerPage, 10),
    includeParenthesesTown: form.includeParenthesesTown,
  };
}

function buildAddressQueryRequest(form: AddressQueryFormState): Exclude<
  JapanAddressSearchInput,
  string
> {
  // 주소 모드에서는 비어 있는 필드를 생략해 더 의미 있는 요청만 서버로 보낸다.
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

function normalizeModeForSummary(mode: SearchMode | null) {
  // 요약 패널에는 내부 enum 대신 외부 API 관점에서 읽기 쉬운 이름을 사용한다.
  if (mode === "postal-code") {
    return "postalCode";
  }

  if (mode === "address-query") {
    return "addressQuery";
  }

  return null;
}

// `useJapanAddress()` 훅이 우편번호 검색과 주소 검색을 한 상태로 통합하는 방식을 보여준다.
export function UseJapanAddressPanel({
  demoApiBaseUrl,
}: UseJapanAddressPanelProps) {
  // base URL 이 바뀔 때만 dataSource 를 다시 만들어 훅 상태가 불필요하게 초기화되지 않게 한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const [mode, setMode] = useState<SearchMode>(DEFAULT_MODE);
  const [postalCodeForm, setPostalCodeForm] = useState(DEFAULT_POSTAL_CODE_FORM);
  const [addressQueryForm, setAddressQueryForm] = useState(
    DEFAULT_ADDRESS_QUERY_FORM,
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<JapanAddress | null>(
    null,
  );
  const [lastSubmittedMode, setLastSubmittedMode] = useState<SearchMode | null>(
    null,
  );
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState<
    Exclude<JapanPostalCodeSearchInput, string> | Exclude<
      JapanAddressSearchInput,
      string
    > | null
  >(null);

  // 주소 검색 훅의 debounce 설정은 주소 모드 폼 입력에서만 가져오되,
  // 훅 자체는 두 모드가 공유하므로 항상 같은 인스턴스를 유지한다.
  const debounceMs = parseNonNegativeInteger(addressQueryForm.debounceMs, 0);
  const addressState = useJapanAddress({
    dataSource,
    debounceMs,
  });
  // 두 모드 각각의 draft 요청을 항상 계산해 두면
  // 현재 화면 상태를 요약 패널과 버튼 활성화 조건에 재사용할 수 있다.
  const postalCodeDraftRequest = buildPostalCodeRequest(postalCodeForm);
  const addressQueryDraftRequest = buildAddressQueryRequest(addressQueryForm);
  const draftRequest =
    mode === "postal-code" ? postalCodeDraftRequest : addressQueryDraftRequest;
  const canSearchPostalCode = postalCodeDraftRequest.postalCode.length > 0;
  const canSearchAddressQuery =
    normalizeText(addressQueryForm.addressQuery) !== undefined ||
    normalizeText(addressQueryForm.prefName) !== undefined ||
    normalizeText(addressQueryForm.cityName) !== undefined ||
    normalizeText(addressQueryForm.townName) !== undefined;
  const canSearch =
    mode === "postal-code" ? canSearchPostalCode : canSearchAddressQuery;
  const results = addressState.data?.elements ?? [];
  const summaryMode = normalizeModeForSummary(lastSubmittedMode);
  const hookStateSummary = {
    mode: summaryMode,
    loading: addressState.loading,
    hasSubmitted,
    totalElements: addressState.data?.totalElements ?? 0,
    pageNumber: addressState.data?.pageNumber ?? null,
    rowsPerPage: addressState.data?.rowsPerPage ?? null,
    error: addressState.error?.message ?? null,
  };

  function updatePostalCodeField<K extends keyof PostalCodeFormState>(
    field: K,
    value: PostalCodeFormState[K],
  ) {
    // 필드 단위 업데이트 함수를 분리해 JSX 의 onChange 로직을 단순하게 유지한다.
    setPostalCodeForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateAddressQueryField<K extends keyof AddressQueryFormState>(
    field: K,
    value: AddressQueryFormState[K],
  ) {
    setAddressQueryForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleReset() {
    // 현재 모드와 폼뿐 아니라 마지막 요청, 선택 결과, 훅 내부 캐시까지 모두 초기화한다.
    setMode(DEFAULT_MODE);
    setPostalCodeForm(DEFAULT_POSTAL_CODE_FORM);
    setAddressQueryForm(DEFAULT_ADDRESS_QUERY_FORM);
    setHasSubmitted(false);
    setSelectedAddress(null);
    setLastSubmittedMode(null);
    setLastSubmittedRequest(null);
    addressState.reset();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "postal-code") {
      // 어떤 모드로 제출했는지 기록해 두어 요약 패널이
      // 마지막 실제 검색 동작을 정확히 보여줄 수 있게 한다.
      const request = buildPostalCodeRequest(postalCodeForm);

      setHasSubmitted(true);
      setLastSubmittedMode(mode);
      setLastSubmittedRequest(request);
      await addressState.searchByPostalCode(request);
      return;
    }

    const request = buildAddressQueryRequest(addressQueryForm);

    setHasSubmitted(true);
    setLastSubmittedMode(mode);
    setLastSubmittedRequest(request);
    await addressState.searchByAddressQuery(request);
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6">useJapanAddress()</Typography>
        <Typography color="text.secondary" variant="body2">
          Switch between postal-code lookup and address-query search while
          watching one shared hook state update inline.
        </Typography>
      </Stack>

      <Stack component="form" spacing={2} noValidate onSubmit={handleSubmit}>
        <Stack spacing={1}>
          <Typography variant="subtitle1">Search mode</Typography>
          {/* 하나의 훅 인스턴스를 유지한 채 입력 폼만 전환해
              두 검색 방식이 같은 상태 머신을 공유하는 모습을 보여준다. */}
          <RadioGroup
            row
            name="use-japan-address-mode"
            value={mode}
            onChange={(event) => setMode(event.target.value as SearchMode)}
          >
            <FormControlLabel
              control={<Radio />}
              label="Postal code mode"
              value="postal-code"
            />
            <FormControlLabel
              control={<Radio />}
              label="Address query mode"
              value="address-query"
            />
          </RadioGroup>
        </Stack>

        {mode === "postal-code" ? (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Postal code"
                value={postalCodeForm.postalCode}
                helperText="Use 3-7 digits. Hyphen is optional."
                onChange={(event) =>
                  updatePostalCodeField("postalCode", event.target.value)
                }
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
                value={postalCodeForm.pageNumber}
                helperText="Zero-based page index."
                onChange={(event) =>
                  updatePostalCodeField("pageNumber", event.target.value)
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
                value={postalCodeForm.rowsPerPage}
                onChange={(event) =>
                  updatePostalCodeField("rowsPerPage", event.target.value)
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
                    checked={postalCodeForm.includeParenthesesTown}
                    onChange={(event) =>
                      updatePostalCodeField(
                        "includeParenthesesTown",
                        event.target.checked,
                      )
                    }
                  />
                }
                label="Include parentheses town"
              />
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Address query"
                value={addressQueryForm.addressQuery}
                onChange={(event) =>
                  updateAddressQueryField("addressQuery", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Prefecture name"
                value={addressQueryForm.prefName}
                onChange={(event) =>
                  updateAddressQueryField("prefName", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="City name"
                value={addressQueryForm.cityName}
                onChange={(event) =>
                  updateAddressQueryField("cityName", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Town name"
                value={addressQueryForm.townName}
                onChange={(event) =>
                  updateAddressQueryField("townName", event.target.value)
                }
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Page number"
                type="number"
                value={addressQueryForm.pageNumber}
                helperText="Zero-based page index."
                onChange={(event) =>
                  updateAddressQueryField("pageNumber", event.target.value)
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
                value={addressQueryForm.rowsPerPage}
                onChange={(event) =>
                  updateAddressQueryField("rowsPerPage", event.target.value)
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
                value={addressQueryForm.debounceMs}
                onChange={(event) =>
                  updateAddressQueryField("debounceMs", event.target.value)
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
                    checked={addressQueryForm.includeCityDetails}
                    onChange={(event) =>
                      updateAddressQueryField(
                        "includeCityDetails",
                        event.target.checked,
                      )
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
                    checked={addressQueryForm.includePrefectureDetails}
                    onChange={(event) =>
                      updateAddressQueryField(
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
        )}

        <Box sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
          <Button
            disabled={!canSearch}
            loading={addressState.loading}
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
        {/* 현재 화면의 draft 또는 마지막 제출 요청을 그대로 노출해
            모드 전환 시 어떤 payload 가 만들어지는지 확인할 수 있다. */}
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
            {
              requestMode: normalizeModeForSummary(mode),
              request: lastSubmittedRequest ?? draftRequest,
            },
            null,
            2,
          )}
        </Box>
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle1">Unified hook state</Typography>
        {/* 하나의 훅이 두 검색 모드를 처리하므로
            로딩/에러/페이지 상태가 어떤 식으로 합쳐지는지 별도 패널로 보여 준다. */}
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
          {JSON.stringify(hookStateSummary, null, 2)}
        </Box>
      </Stack>

      {addressState.error ? (
        <Alert severity="error">{addressState.error.message}</Alert>
      ) : null}

      {!addressState.loading &&
      !addressState.error &&
      hasSubmitted &&
      results.length === 0 ? (
        <Alert severity="info">No results found.</Alert>
      ) : null}

      {!addressState.loading && !addressState.error && results.length > 0 ? (
        <Stack spacing={1.5}>
          <Typography color="text.secondary" variant="body2">
            {addressState.data?.totalElements ?? results.length} result(s) on
            page {(addressState.data?.pageNumber ?? 0) + 1}
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
                {/* 검색 방식과 무관하게 결과 행은 동일한 주소 카드 모양으로 통일한다. */}
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
