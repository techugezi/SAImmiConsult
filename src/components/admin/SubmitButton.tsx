"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingText?: string;
};

export default function SubmitButton({
  pendingText,
  disabled,
  children,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button {...props} disabled={disabled || pending}>
      {pending ? pendingText ?? children : children}
    </button>
  );
}
