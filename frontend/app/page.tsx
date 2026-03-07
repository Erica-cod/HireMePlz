export default function HomePage() {
  return (
    <main className="page hero">
      <div className="card stack">
        <h1>HireMePlz</h1>
        <p className="muted">
          A tool that helps job seekers manage profile data, autofill application forms, track submissions, and discover matching jobs.
        </p>
        <div className="grid two">
          <div className="listItem">
            <h3>Profile Center</h3>
            <p className="muted">Maintain personal info, education, experiences, and story library in one place.</p>
          </div>
          <div className="listItem">
            <h3>Smart Autofill</h3>
            <p className="muted">The browser extension scans fields and asks the backend for suggestions and long-form answers.</p>
          </div>
          <div className="listItem">
            <h3>Application Tracking</h3>
            <p className="muted">Store every autofill session and update statuses over time.</p>
          </div>
          <div className="listItem">
            <h3>Job Recommendations</h3>
            <p className="muted">Worker tasks fetch jobs and compute basic matches based on user preferences.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <a className="button primary" href="/auth">
            Sign in now
          </a>
          <a className="button secondary" href="/dashboard">
            Open dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
