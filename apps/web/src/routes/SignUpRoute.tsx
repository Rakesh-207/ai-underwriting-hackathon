import { SignUp } from '@clerk/react';

// Clerk-powered <SignUp /> at /sign-up. Redirects to /app on success.
// (auth contract 4.1, P1A acceptance gate)
export function SignUpRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <SignUp routing="path" path="/sign-up" />
      </div>
    </div>
  );
}
