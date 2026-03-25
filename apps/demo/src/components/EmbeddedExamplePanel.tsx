import {
  formatJapanPostalCode,
  normalizeJapanPostalCode,
  useJapanAddressSearch,
  useJapanPostalCode,
  type JapanAddress,
} from "@cp949/japanpost-react";
import {
  Alert,
  Box,
  Button,
  Grid,
  List,
  ListItemButton,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import { createDemoApiDataSource } from "../demoApi";
import {
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
} from "./japanAddressDisplay";
import { SelectedAddressDetails } from "./SelectedAddressDetails";

type EmbeddedExamplePanelProps = {
  demoApiBaseUrl: string;
  initialAddress: JapanAddress;
};

const EMBEDDED_ROWS_PER_PAGE = 10;

function sanitizePostalCodeInput(value: string): string {
  // 우편번호 필드에는 숫자와 하이픈만 남겨
  // 사용자가 붙여넣은 불필요한 문자를 즉시 제거한다.
  return value.replace(/[^\d-]/g, "");
}

function isSearchablePostalCode(value: string): boolean {
  // 데모도 공개 훅 계약과 같은 기준을 사용해 3-7자리 prefix lookup을 허용한다.
  const normalizedValue = normalizeJapanPostalCode(value);
  return normalizedValue.length >= 3 && normalizedValue.length <= 7;
}

// 검색 다이얼로그를 쓰지 않고, 페이지 안에서 바로 우편번호/주소 검색을 수행하는 예제다.
export function EmbeddedExamplePanel({
  demoApiBaseUrl,
  initialAddress,
}: EmbeddedExamplePanelProps) {
  // 베이스 URL 이 바뀔 때만 데이터 소스를 새로 만들어 훅 인스턴스가 불필요하게 재생성되지 않게 한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const postalCodeSearch = useJapanPostalCode({ dataSource });
  const addressSearch = useJapanAddressSearch({
    dataSource,
    debounceMs: 0,
  });
  const [selectedAddress, setSelectedAddress] = useState(initialAddress);
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // 우편번호가 입력되면 우편번호 검색을 우선하고,
  // 비어 있을 때만 주소 키워드 검색 상태를 활성 상태로 간주한다.
  const trimmedAddress = address.trim();
  const postalCodeHasValue = postalCode.length > 0;
  const postalCodeIsValid = isSearchablePostalCode(postalCode);
  const canSearch = postalCodeHasValue
    ? postalCodeIsValid
    : trimmedAddress !== "";
  const activeSearchState = postalCodeHasValue
    ? postalCodeSearch
    : trimmedAddress !== ""
      ? addressSearch
      : null;
  const results = activeSearchState?.data?.elements ?? [];
  const loading = activeSearchState?.loading ?? false;
  const error = activeSearchState?.error ?? null;
  const pageNumber = activeSearchState?.data?.pageNumber ?? 0;
  const totalElements = activeSearchState?.data?.totalElements ?? 0;
  const totalPages = Math.ceil(totalElements / EMBEDDED_ROWS_PER_PAGE);

  function resetSearchState() {
    // 입력 모드가 바뀌면 이전 검색 결과와 에러를 버려
    // 서로 다른 훅 상태가 화면에 섞여 보이지 않도록 한다.
    setHasSearched(false);
    postalCodeSearch.reset();
    addressSearch.reset();
  }

  function handlePostalCodeChange(nextValue: string) {
    setPostalCode(sanitizePostalCodeInput(nextValue));
    setAddress("");
    resetSearchState();
  }

  function handleAddressChange(nextValue: string) {
    setAddress(nextValue);
    setPostalCode("");
    resetSearchState();
  }

  async function runSearch(nextPageNumber: number) {
    if (!canSearch) {
      return;
    }

    // 한 번이라도 검색을 시도했는지 기억해 두면
    // 초기 빈 화면과 "결과 없음" 상태를 구분해서 렌더링할 수 있다.
    setHasSearched(true);

    if (postalCodeHasValue) {
      await postalCodeSearch.search({
        postalCode,
        pageNumber: nextPageNumber,
        rowsPerPage: EMBEDDED_ROWS_PER_PAGE,
      });
      return;
    }

    await addressSearch.search({
      addressQuery: trimmedAddress,
      pageNumber: nextPageNumber,
      rowsPerPage: EMBEDDED_ROWS_PER_PAGE,
    });
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h6">Embedded</Typography>
        <Typography color="text.secondary" variant="body2">
          Search by postal code or address keyword directly in the page.
        </Typography>
      </Stack>

      <Stack
        component="form"
        spacing={2}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch(0);
        }}
      >
        {/* 두 입력은 상호 배타적으로 동작한다.
            하나를 수정하면 다른 하나를 비워 "현재 어떤 검색 모드인지"를 명확히 한다. */}
        <Grid container spacing={1}>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField
              fullWidth
              label="Postal code"
              value={postalCode}
              error={postalCodeHasValue && !postalCodeIsValid}
              helperText="Use 3-7 digits. Hyphen is optional."
              onChange={(event) => handlePostalCodeChange(event.target.value)}
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                },
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <TextField
              fullWidth
              label="Address"
              value={address}
              onChange={(event) => handleAddressChange(event.target.value)}
            />
          </Grid>
        </Grid>

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Button
            disabled={!canSearch || loading}
            type="submit"
            variant="contained"
            loading={loading}
          >
            Search
          </Button>
        </Box>
      </Stack>

      {error ? <Alert severity="error">{error.message}</Alert> : null}

      {!loading && !error && hasSearched && results.length === 0 ? (
        <Alert severity="info">No results found.</Alert>
      ) : null}

      {!loading && !error && results.length > 0 ? (
        <Stack spacing={2}>
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
                {/* 결과 목록은 우편번호와 정제된 주소를 함께 보여
                    사용자가 동일한 지역명을 빠르게 구분할 수 있게 한다. */}
                <Stack alignItems="flex-start" spacing={0.25}>
                  <Typography color="text.secondary" variant="body2">
                    {formatJapanPostalCode(result.postalCode)}
                  </Typography>
                  <Typography>{formatJapanAddressDisplay(result)}</Typography>
                </Stack>
              </ListItemButton>
            ))}
          </List>

          {totalPages > 1 ? (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              {/* 서버는 0-base 페이지를 사용하지만 UI Pagination 은 1-base 이므로 서로 변환한다. */}
              <Pagination
                color="primary"
                count={totalPages}
                disabled={loading}
                onChange={(_event, page) => {
                  void runSearch(page - 1);
                }}
                page={pageNumber + 1}
              />
            </Box>
          ) : null}
        </Stack>
      ) : null}

      <SelectedAddressDetails value={selectedAddress} />
    </Stack>
  );
}
