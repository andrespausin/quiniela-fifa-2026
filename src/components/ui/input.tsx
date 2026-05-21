import { type InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, error, className = "", id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={inputId}
        className={`h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900 ${
          error ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""
        } ${className}`}
        {...rest}
      />
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
});
