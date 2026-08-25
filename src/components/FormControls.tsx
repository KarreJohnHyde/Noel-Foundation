import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({
  label,
  hint,
  error,
  id,
  ...props
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = id || props.name;
  const required = props.required ?? label.trim().endsWith("*");
  const descriptionId = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  return (
    <label className="field" htmlFor={controlId}>
      <span className="field__label">{label}</span>
      <input
        {...props}
        id={controlId}
        required={required}
        className={error ? "field__control field__control--error" : "field__control"}
        aria-invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={descriptionId}
      />
      {error ? (
        <span className="field__error" id={descriptionId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={descriptionId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  ...props
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const controlId = id || props.name;
  const required = props.required ?? label.trim().endsWith("*");
  const descriptionId = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  return (
    <label className="field" htmlFor={controlId}>
      <span className="field__label">{label}</span>
      <select
        {...props}
        id={controlId}
        required={required}
        className={error ? "field__control field__control--error" : "field__control"}
        aria-invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={descriptionId}
      >
        {children}
      </select>
      {error ? (
        <span className="field__error" id={descriptionId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={descriptionId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlId = id || props.name;
  const required = props.required ?? label.trim().endsWith("*");
  const descriptionId = error ? `${controlId}-error` : hint ? `${controlId}-hint` : undefined;
  return (
    <label className="field" htmlFor={controlId}>
      <span className="field__label">{label}</span>
      <textarea
        {...props}
        id={controlId}
        required={required}
        className={error ? "field__control field__control--error" : "field__control"}
        aria-invalid={Boolean(error)}
        aria-required={required || undefined}
        aria-describedby={descriptionId}
      />
      {error ? (
        <span className="field__error" id={descriptionId} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span className="field__hint" id={descriptionId}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function ConsentField({
  id,
  checked,
  onChange,
  children,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="consent" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          required
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-required="true"
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
