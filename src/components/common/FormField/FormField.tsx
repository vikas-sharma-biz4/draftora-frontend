"use client";

import { useId } from "react";

interface FormFieldProps {
  /** Visible label text */
  label: string;
  /** Optional inline tip appended after the label */
  tip?: string;
  /** Validation error message — also wires aria-describedby on child input */
  error?: string;
  /** Helper text shown below the input when there is no error */
  hint?: string;
  /** The input/select/textarea — receives id, aria-describedby automatically */
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    hasError: boolean;
  }) => React.ReactNode;
  /** Extra class on the outer .form-group wrapper */
  className?: string;
}

/**
 * FormField compound component.
 *
 * Auto-generates stable IDs and wires aria-describedby between label, input,
 * hint, and error so screen readers announce the full context.
 *
 * @example
 * <FormField label="Client name" error={errors.name?.message}>
 *   {(fieldProps) => (
 *     <Input {...fieldProps} {...register("name")} placeholder="Acme Corp" />
 *   )}
 * </FormField>
 */
export default function FormField({
  label,
  tip,
  error,
  hint,
  children,
  className,
}: FormFieldProps): JSX.Element {
  const uid = useId();
  const inputId  = `${uid}-input`;
  const errorId  = `${uid}-error`;
  const hintId   = `${uid}-hint`;

  const describedBy =
    error ? errorId : hint ? hintId : undefined;

  return (
    <div className={["form-group", className].filter(Boolean).join(" ")}>
      <label className="form-label" htmlFor={inputId}>
        {label}
        {tip && <span className="form-label-tip">&nbsp;— {tip}</span>}
      </label>

      {children({
        id: inputId,
        "aria-describedby": describedBy,
        hasError: !!error,
      })}

      {error && (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
