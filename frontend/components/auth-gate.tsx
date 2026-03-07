"use client";

import { useEffect, useState } from "react";

type AuthGateProps = {
  children: (token: string) => React.ReactNode;
};

export function AuthGate({ children }: AuthGateProps) {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(window.localStorage.getItem("hiremeplz-token"));
  }, []);

  if (!token) {
    return (
      <div className="rounded-xl border bg-white p-6 shadow-sm text-center">
        <h2 className="text-lg font-semibold mb-2">Please sign in first</h2>
        <p className="text-gray-500 text-sm mb-4">
          You must be signed in to access this page.
        </p>
        <a
          href="/auth"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700"
        >
          Go to sign-in page
        </a>
      </div>
    );
  }

  return <>{children(token)}</>;
}
