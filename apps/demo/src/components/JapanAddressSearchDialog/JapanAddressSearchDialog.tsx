import {
  formatJapanPostalCode,
  formatJapanAddressDisplay,
  formatJapanAddressSearchResultLabel,
  normalizeJapanPostalCode,
} from "@cp949/japanpost-react";
import {
  useJapanAddressSearch,
  useJapanPostalCode,
} from "@cp949/japanpost-react/client";
import type { JapanAddress } from "@cp949/japanpost-react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  List,
  ListItemButton,
  Pagination,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createDemoApiDataSource } from "../../demoApi";

type JapanAddressSearchDialogProps = {
  demoApiBaseUrl: string;
  open: boolean;
  onRequestClose: () => void;
  onSelectAddress: (address: JapanAddress) => void;
};

const DIALOG_ROWS_PER_PAGE = 10;

function sanitizePostalCodeInput(value: string): string {
  // 다이얼로그 입력창에서도 우편번호 형식과 무관한 문자는 즉시 제거한다.
  return value.replace(/[^\d-]/g, "");
}

function isSearchablePostalCode(value: string): boolean {
  // 데모도 공개 훅 계약과 같은 기준을 사용해 3-7자리 prefix lookup을 허용한다.
  const normalizedValue = normalizeJapanPostalCode(value);
  return normalizedValue.length >= 3 && normalizedValue.length <= 7;
}

// 읽기 전용 주소 필드와 결합되는 검색 모달이다.
// 우편번호 검색과 주소 키워드 검색을 하나의 대화상자 안에 함께 제공한다.
export function JapanAddressSearchDialog({
  demoApiBaseUrl,
  open,
  onRequestClose,
  onSelectAddress,
}: JapanAddressSearchDialogProps) {
  // 다이얼로그가 열려 있는 동안 동일한 데이터 소스를 공유해 두 검색 훅이 같은 API 설정을 사용하게 한다.
  const dataSource = useMemo(
    () => createDemoApiDataSource(demoApiBaseUrl),
    [demoApiBaseUrl],
  );
  const postalCodeSearch = useJapanPostalCode({ dataSource });
  const addressSearch = useJapanAddressSearch({
    dataSource,
    debounceMs: 0,
  });
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

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
  const totalPages = Math.ceil(totalElements / DIALOG_ROWS_PER_PAGE);

  const resetState = useCallback(() => {
    // 다이얼로그를 닫았다가 다시 열면 이전 검색 결과가 남지 않도록
    // 입력값과 훅 상태를 모두 초기화한다.
    setPostalCode("");
    setAddress("");
    setHasSearched(false);
    postalCodeSearch.reset();
    addressSearch.reset();
  }, [addressSearch, postalCodeSearch]);

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  function handleRequestClose() {
    onRequestClose();
  }

  function handlePostalCodeChange(nextValue: string) {
    setPostalCode(sanitizePostalCodeInput(nextValue));
    setAddress("");
    setHasSearched(false);
    postalCodeSearch.reset();
    addressSearch.reset();
  }

  function handleAddressChange(nextValue: string) {
    setAddress(nextValue);
    setPostalCode("");
    setHasSearched(false);
    postalCodeSearch.reset();
    addressSearch.reset();
  }

  async function runSearch(nextPageNumber: number) {
    if (!canSearch) {
      return;
    }

    // "아직 검색 안 함" 과 "검색했지만 결과 없음" 을 구분하기 위한 플래그다.
    setHasSearched(true);

    if (postalCodeHasValue) {
      await postalCodeSearch.search({
        postalCode,
        pageNumber: nextPageNumber,
        rowsPerPage: DIALOG_ROWS_PER_PAGE,
      });
      return;
    }

    await addressSearch.search({
      addressQuery: trimmedAddress,
      pageNumber: nextPageNumber,
      rowsPerPage: DIALOG_ROWS_PER_PAGE,
    });
  }

  async function handleSearch() {
    await runSearch(0);
  }

  function handleSelect(address: JapanAddress) {
    // 결과를 선택하면 부모 상태를 갱신하고 바로 닫아
    // 다이얼로그가 주소 선택 전용 UI 로 느껴지게 한다.
    onSelectAddress(address);
    onRequestClose();
  }

  return (
    <Dialog
      aria-labelledby="search-address-dialog-title"
      aria-describedby="search-address-dialog-description"
      fullWidth
      maxWidth="sm"
      onClose={handleRequestClose}
      open={open}
    >
      <DialogTitle id="search-address-dialog-title">Search address</DialogTitle>

      <DialogContent dividers sx={{ maxHeight: "70vh", minHeight: "70vh" }}>
        <Stack
          component="form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearch();
          }}
        >
          {/* 우편번호 검색과 주소 검색은 같은 결과 영역을 공유하므로
              입력 중 하나를 수정할 때 다른 입력값은 자동으로 비운다. */}
          <DialogContentText id="search-address-dialog-description">
            Search by postal code or address keyword.
          </DialogContentText>
          <Grid container spacing={1} sx={{ mt: 3 }}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                autoFocus
                fullWidth
                margin="none"
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
                margin="none"
                value={address}
                onChange={(event) => handleAddressChange(event.target.value)}
              />
            </Grid>
          </Grid>

          <Box
            sx={{
              mt: 2,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
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

          {error ? <Alert severity="error">{error.message}</Alert> : null}

          {!loading && !error && hasSearched && results.length === 0 ? (
            <Alert severity="info">No results found.</Alert>
          ) : null}

          {!loading && !error && results.length > 0 ? (
            <List disablePadding sx={{ width: "100%", mt: 3 }}>
              {results.map((address) => (
                <ListItemButton
                  key={[
                    address.provider,
                    address.postalCode,
                    address.prefecture,
                    address.city,
                    address.town,
                    address.address,
                  ].join("|")}
                  aria-label={formatJapanAddressSearchResultLabel(address)}
                  onClick={() => handleSelect(address)}
                >
                  {/* 주소를 누르는 즉시 선택이 완료되므로,
                      목록 아이템 자체를 버튼처럼 동작하게 구성했다. */}
                  <Stack alignItems="flex-start" spacing={0.25}>
                    <Typography variant="body2" color="text.secondary">
                      {formatJapanPostalCode(address.postalCode)}
                    </Typography>
                    <Typography>
                      {formatJapanAddressDisplay(address)}
                    </Typography>
                  </Stack>
                </ListItemButton>
              ))}
            </List>
          ) : null}
        </Stack>
      </DialogContent>
      {totalPages > 1 && (
        <DialogActions sx={{ justifyContent: "center", py: 1, minHeight: 64 }}>
          {/* 내부 요청은 0-base, 페이지네이션 UI 는 1-base 이므로 양방향 변환을 적용한다. */}
          <Pagination
            color="primary"
            count={totalPages}
            disabled={loading}
            onChange={(_event, page) => {
              void runSearch(page - 1);
            }}
            page={pageNumber + 1}
          />
        </DialogActions>
      )}
      <DialogActions>
        <Button onClick={handleRequestClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
