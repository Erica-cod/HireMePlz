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
      <div className="card">
        <h2>Please sign in first</h2>
        <p className="muted">You must be signed in to access this page.</p>
        <a className="button primary" href="/auth">
          Go to sign-in page
        </a>
      </div>
    );
  }

  return <>{children(token)}</>;
}
