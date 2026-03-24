import { type SyntheticEvent, useState } from "react";
import type { AddressSearchInputProps } from "../core/types";

/**
 * 스타일 의존성이 없는 최소한의 주소 키워드 검색 입력 컴포넌트.
 * value를 전달하면 제어 모드, 전달하지 않으면 비제어 모드로 동작한다.
 * 검색 시 trim 처리를 내부에서 수행해 공백만 다른 입력이 별도 쿼리로 번지지 않게 한다.
 */
export function AddressSearchInput({
  defaultValue = "",
  value,
  disabled,
  label = "Address keyword",
  buttonLabel = "Search",
  inputProps,
  buttonProps,
  onChange,
  onSearch,
}: AddressSearchInputProps) {
  // 비제어 모드에서 사용하는 내부 상태
  const [internalValue, setInternalValue] = useState(defaultValue);

  // 제어 모드(value 제공 시)에는 외부 값을, 비제어 모드에는 내부 상태를 사용
  const currentValue = value ?? internalValue;

  /**
   * 폼 제출 시 앞뒤 공백을 제거한 뒤 onSearch 콜백으로 전달한다.
   */
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault(); // 기본 폼 제출 동작(페이지 이동) 방지
    onSearch(currentValue.trim());
  }

  /**
   * 입력값 변경 처리.
   * 비제어 모드에서만 내부 상태를 갱신하고, 항상 onChange 콜백을 호출한다.
   */
  function handleChange(nextValue: string) {
    // 외부에서 value를 제어하지 않는 경우에만 내부 상태 갱신
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onChange?.(nextValue); // onChange가 있을 때만 호출
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        {label}
        <input
          {...inputProps}
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
}
