"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";

import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export function PasswordInput({
  id,
  label = "密码",
  labelHidden = false,
  error,
  disabled,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  id: string;
  label?: string;
  labelHidden?: boolean;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);
  const errorId = error ? `${id}-error` : props["aria-describedby"];

  return (
    <Field data-invalid={Boolean(error)} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id} className={labelHidden ? "sr-only" : undefined}>
        {label}
      </FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={errorId}
          disabled={disabled}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label={visible ? "隐藏密码" : "显示密码"}
            onClick={() => setVisible((value) => !value)}
            disabled={disabled}
            size="icon-xs"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  );
}
