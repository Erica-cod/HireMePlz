"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";

import { apiRequest } from "../../lib/api";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    try {
      setLoading(true);
      setMessage("");

      const data = await apiRequest<{
        token: string;
      }>(`/auth/${mode}`, {
        method: "POST",
        body: { email, password }
      });

      window.localStorage.setItem("hiremeplz-token", data.token);
      window.location.href = "/dashboard";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="card stack" style={{ maxWidth: 560, margin: "0 auto" }}>
        <h1>{mode === "login" ? "Sign in" : "Register"} HireMePlz</h1>
        <p className="muted">
          After signing in, you can manage your profile and provide data for the Chrome autofill extension.
        </p>
        <input
          className="input"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="input"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="button primary" onClick={handleSubmit} disabled={loading}>
          {loading ? "Submitting..." : mode === "login" ? "Sign in" : "Register"}
        </button>
        <button
          className="button secondary"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          Switch to {mode === "login" ? "Register" : "Sign in"}
        </button>
        {message ? <p>{message}</p> : null}
      </div>
    </main>
  );
}
