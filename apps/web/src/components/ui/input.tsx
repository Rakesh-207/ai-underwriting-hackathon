import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={[
        'flex h-11 w-full bg-surface border border-border rounded-md px-3 text-md text-ink',
        'placeholder:text-muted',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors',
        className,
      ].join(' ')}
      {...props}
    />
  );
});
