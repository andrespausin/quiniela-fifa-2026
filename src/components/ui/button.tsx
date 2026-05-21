"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-600/60",
  secondary:
    "bg-zinc-200 hover:bg-zinc-300 text-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100",
  ghost:
    "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100",
  danger:
    "bg-red-600 hover:bg-red-700 text-white disabled:bg-red-600/60",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", loading, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
});
