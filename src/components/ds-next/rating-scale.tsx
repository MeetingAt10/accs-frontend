import { Radio, RadioGroup } from "@meetingat10/design-system/react";

export interface RatingScaleProps {
  label: string;
  description?: string;
  value?: number;
  onChange?: (value: number) => void;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  lowLabel?: string;
  highLabel?: string;
}

export function RatingScale({
  label,
  description,
  value,
  onChange,
  isRequired,
  isInvalid,
  errorMessage,
  isReadOnly,
  isDisabled,
  lowLabel = "Strongly disagree",
  highLabel = "Strongly agree",
}: RatingScaleProps) {
  return (
    <RadioGroup
      row
      label={label}
      description={[description, `1 · ${lowLabel}; 5 · ${highLabel}`]
        .filter(Boolean)
        .join(" · ")}
      value={value === undefined ? "" : String(value)}
      onChange={(next) => onChange?.(Number(next))}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      isReadOnly={isReadOnly}
      isDisabled={isDisabled}
    >
      {[1, 2, 3, 4, 5].map((rating) => (
        <Radio value={String(rating)} key={rating}>
          {rating}
        </Radio>
      ))}
    </RadioGroup>
  );
}
