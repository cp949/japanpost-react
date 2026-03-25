import { forwardRef, type SyntheticEvent, useState } from "react";
import type { AddressSearchInputProps } from "../core/types";

/**
 * 스타일 의존성이 없는 최소한의 주소 키워드 검색 입력 컴포넌트.
 * `value`를 넘기면 제어 모드, 그렇지 않으면 `defaultValue` 기반 비제어 모드로 동작한다.
 * 검색 시 trim 처리를 내부에서 수행해 공백 차이만 있는 입력이 별도 쿼리로 번지지 않게 한다.
 */
export const AddressSearchInput = forwardRef<
  HTMLInputElement,
  AddressSearchInputProps
>(function AddressSearchInput(
  {
    defaultValue = "",
    value,
    disabled,
    label = "Address keyword",
    buttonLabel = "Search",
    inputProps,
    buttonProps,
    onChange,
    onSearch,
  }: AddressSearchInputProps,
  ref,
) {
  // 비제어 모드(`value === undefined`)일 때만 사용하는 내부 상태다.
  const [internalValue, setInternalValue] = useState(defaultValue);

  // 제어/비제어 입력을 같은 렌더링 경로로 합친다.
  const currentValue = value ?? internalValue;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(currentValue.trim());
  }

  function handleChange(nextValue: string) {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {label}
        <input
          {...inputProps}
          ref={ref}
          disabled={disabled}
          value={currentValue}
          onChange={(event) => handleChange(event.target.value)}
        />
      </label>
      <button {...buttonProps} disabled={disabled} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
});
