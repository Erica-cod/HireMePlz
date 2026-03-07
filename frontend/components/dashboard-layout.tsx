import type { ReactNode } from "react";

export function DashboardLayout({
  children,
  title,
  description
}: {
  children: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <main className="page">
      <div className="stack" style={{ marginBottom: 24 }}>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>

      <nav className="nav">
        <a href="/dashboard">Overview</a>
        <a href="/dashboard/profile">Profile</a>
        <a href="/dashboard/experiences">Experiences</a>
        <a href="/dashboard/stories">Story Library</a>
        <a href="/dashboard/applications">Applications</a>
      </nav>

      {children}
    </main>
  );
}
