import { SignIn } from '@clerk/react';

// Clerk-powered <SignIn /> at /sign-in. Redirects to /app on success.
// (auth contract 4.1, P1A acceptance gate)
export function SignInRoute() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        <SignIn routing="path" path="/sign-in" />
      </div>
    </div>
  );
}
