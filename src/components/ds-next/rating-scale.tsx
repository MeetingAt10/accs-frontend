import { motion, useReducedMotion } from "motion/react";
import { useId, useRef, type KeyboardEvent } from "react";

// Styles (.rs*) live in src/components/app/evaluations.css, which every importer of this file loads.

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

const steps = [1, 2, 3, 4, 5];

/** Segmented 1-5 scale: radio group semantics, arrow/Home/End keys, springy sliding highlight. */
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
  const uid = useId();
  const reduce = useReducedMotion();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const editable = !isReadOnly && !isDisabled && Boolean(onChange);
  const labelId = `${uid}-label`;
  const descId = `${uid}-desc`;
  const errorId = `${uid}-error`;
  const tabbable = value ?? 1;

  function pick(next: number) {
    if (!editable) return;
    onChange?.(next);
    refs.current[next - 1]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown")
      next = current === 5 ? 1 : current + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = current === 1 ? 5 : current - 1;
    else if (event.key === "Home") next = 1;
    else if (event.key === "End") next = 5;
    if (next === undefined) return;
    event.preventDefault();
    pick(next);
  }

  return (
    <div
      className="rs"
      data-invalid={isInvalid ? "true" : undefined}
      data-readonly={isReadOnly ? "true" : undefined}
    >
      <div className="rs__head">
        <span className="rs__label" id={labelId}>
          {label}
          {isRequired && (
            <span className="rs__req" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </span>
        {description && (
          <span className="rs__desc" id={descId}>
            {description}
          </span>
        )}
      </div>
      <div
        className="rs__scale"
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={
          [description ? descId : "", isInvalid && errorMessage ? errorId : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-required={isRequired || undefined}
        aria-invalid={isInvalid || undefined}
        aria-readonly={isReadOnly || undefined}
      >
        {steps.map((step) => {
          const selected = value === step;
          return (
            <motion.button
              type="button"
              role="radio"
              key={step}
              ref={(node) => {
                refs.current[step - 1] = node;
              }}
              className="rs__opt"
              aria-checked={selected}
              aria-label={
                step === 1
                  ? `1, ${lowLabel}`
                  : step === 5
                    ? `5, ${highLabel}`
                    : String(step)
              }
              tabIndex={step === tabbable ? 0 : -1}
              disabled={isDisabled}
              onClick={() => pick(step)}
              onKeyDown={(event) => onKeyDown(event, step)}
              whileTap={editable && !reduce ? { scale: 0.9 } : undefined}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
            >
              {selected && (
                <motion.span
                  layoutId={`${uid}-selected`}
                  className="rs__sel"
                  transition={
                    reduce
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 520, damping: 34 }
                  }
                />
              )}
              {step}
            </motion.button>
          );
        })}
      </div>
      <div className="rs__ends" aria-hidden="true">
        <span>1 · {lowLabel}</span>
        <span>5 · {highLabel}</span>
      </div>
      {isInvalid && errorMessage && (
        <p className="rs__error" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
