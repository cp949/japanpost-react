import { forwardRef, type SyntheticEvent, useState } from "react";
import { normalizeJapanPostalCode } from "../core/formatters";
import type { PostalCodeInputProps } from "../core/types";

/**
 * 스타일 의존성이 없는 최소한의 우편번호 입력 컴포넌트.
 * value를 전달하면 제어 모드, 전달하지 않으면 비제어 모드로 동작한다.
 * 제출 시에는 표시 형식이 아니라 정규화된 숫자 문자열을 콜백에 넘기는 것이 핵심 계약이다.
 */
export const PostalCodeInput = forwardRef<HTMLInputElement, PostalCodeInputProps>(
  function PostalCodeInput(
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
    // 비제어 모드에서 사용하는 내부 상태
    const [internalValue, setInternalValue] = useState(defaultValue);

    // 제어 모드(value 제공 시)에는 외부 값을, 비제어 모드에는 내부 상태를 사용
    const currentValue = value ?? internalValue;

    /**
     * 폼 제출 시 우편번호를 정규화(숫자만 추출)해 onSearch 콜백으로 전달한다.
     */
    function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
      event.preventDefault(); // 기본 폼 제출 동작(페이지 이동) 방지
      onSearch(normalizeJapanPostalCode(currentValue));
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
            ref={ref}
            disabled={disabled}
            // 모바일 키패드 힌트만 주고, 실제 유효성 판단은 상위 훅/유틸이 담당한다.
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
  },
);
