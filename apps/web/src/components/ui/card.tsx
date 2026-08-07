import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['bg-surface border border-border rounded-lg shadow-sm', className].join(' ')}
      {...props}
    />
  );
}

export function CardHeader({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['p-6 pb-4', className].join(' ')} {...props} />;
}

export function CardTitle({ className = '', ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={['text-lg font-semibold tracking-tight text-ink', className].join(' ')}
      {...props}
    />
  );
}

export function CardDescription({ className = '', ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={['text-sm text-muted mt-1', className].join(' ')}
      {...props}
    />
  );
}

export function CardContent({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['p-6 pt-0', className].join(' ')} {...props} />;
}

export function CardFooter({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['p-6 pt-4 border-t border-border flex items-center', className].join(' ')}
      {...props}
    />
  );
}
