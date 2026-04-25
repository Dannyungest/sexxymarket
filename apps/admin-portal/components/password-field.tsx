"use client";

import { type CSSProperties, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  required?: boolean;
  containerClassName?: string;
  containerStyle?: CSSProperties;
  inputStyle?: CSSProperties;
};

export function PasswordField({
  value,
  onChange,
  label,
  id,
  placeholder,
  autoComplete,
  disabled,
  required,
  containerClassName,
  containerStyle,
  inputStyle,
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={containerClassName ?? (label ? "field" : undefined)} style={containerStyle}>
      {label ? <label htmlFor={inputId}>{label}</label> : null}
      <div style={{ position: "relative" }}>
        <input
          id={inputId}
          className="text-input"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required={required}
          style={{ paddingRight: "2.6rem", ...inputStyle }}
        />
        <button
          type="button"
          className="chip"
          style={{ position: "absolute", right: 6, top: 4, minHeight: 32, padding: "0.2rem 0.45rem" }}
          onClick={() => setVisible((open) => !open)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}
