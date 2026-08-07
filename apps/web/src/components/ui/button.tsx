import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-contrast hover:opacity-90 active:opacity-100 shadow-sm',
  secondary:
    'bg-surface text-ink border border-border hover:bg-bg shadow-sm',
  outline:
    'bg-transparent text-ink border border-border hover:bg-bg',
  ghost: 'bg-transparent text-ink hover:bg-bg',
  danger:
    'bg-danger text-white hover:opacity-90 shadow-sm',
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-md',
  md: 'h-11 px-5 text-md rounded-md',
  lg: 'h-12 px-7 text-md rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', className = '', ...props },
    ref,
  ) {
    const classes = [
      'inline-flex items-center justify-center gap-2 font-medium transition-opacity',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      'disabled:pointer-events-none disabled:opacity-50',
      variantClasses[variant],
      sizeClasses[size],
      className,
    ].join(' ');
    return <button ref={ref} className={classes} {...props} />;
  },
);
