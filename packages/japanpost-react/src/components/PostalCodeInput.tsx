import { forwardRef, type SyntheticEvent, useState } from "react";
import { normalizeJapanPostalCode } from "../core/formatters";
import type { PostalCodeInputProps } from "../core/types";

/**
 * 스타일 의존성이 없는 최소한의 우편번호 입력 컴포넌트.
 * `value`를 넘기면 제어 모드, 그렇지 않으면 `defaultValue` 기반 비제어 모드로 동작한다.
 * 제출 시에는 표시 형식이 아니라 정규화된 숫자 문자열을 `onSearch`로 넘긴다.
 */
export const PostalCodeInput = forwardRef<
  HTMLInputElement,
  PostalCodeInputProps
>(function PostalCodeInput(
  {
    defaultValue = "",
    value,
    disabled,
    label = "Postal code",
    buttonLabel = "Search",
    inputProps,
    buttonProps,
    onChange,
    onSearch,
  }: PostalCodeInputProps,
  ref,
) {
  // 비제어 모드(`value === undefined`)일 때만 사용하는 내부 상태다.
  const [internalValue, setInternalValue] = useState(defaultValue);

  // 제어/비제어 입력을 같은 렌더링 경로로 합친다.
  const currentValue = value ?? internalValue;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch(normalizeJapanPostalCode(currentValue));
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
          // 키패드 힌트만 주고 실제 유효성 판단은 상위 계층에 맡긴다.
          inputMode={inputProps?.inputMode ?? "numeric"}
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
