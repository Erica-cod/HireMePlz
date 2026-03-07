import { workerEnv } from "./env.js";

type JobAlertInput = {
  toEmail: string;
  toName?: string | null;
  company: string;
  role: string;
  location?: string | null;
  applyUrl: string;
  score: number;
  reasons: string[];
};

export async function sendJobAlert(input: JobAlertInput) {
  if (!workerEnv.sendgridApiKey || !workerEnv.sendgridFromEmail) {
    return false;
  }

  const reasonList = input.reasons.map((reason) => `- ${reason}`).join("\n");
  const text = [
    `Hi ${input.toName || "there"},`,
    "",
    "A new high-match job was found by HireMePlz.",
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    `Location: ${input.location || "Not provided"}`,
    `Match score: ${(input.score * 100).toFixed(0)}%`,
    "",
    "Why this matched:",
    reasonList,
    "",
    `Apply here: ${input.applyUrl}`,
    "",
    "Good luck with your applications!"
  ].join("\n");

  const htmlReasons = input.reasons
    .map((reason) => `<li>${escapeHtml(reason)}</li>`)
    .join("");
  const html = `
    <p>Hi ${escapeHtml(input.toName || "there")},</p>
    <p>A new high-match job was found by HireMePlz.</p>
    <ul>
      <li><strong>Company:</strong> ${escapeHtml(input.company)}</li>
      <li><strong>Role:</strong> ${escapeHtml(input.role)}</li>
      <li><strong>Location:</strong> ${escapeHtml(input.location || "Not provided")}</li>
      <li><strong>Match score:</strong> ${(input.score * 100).toFixed(0)}%</li>
    </ul>
    <p><strong>Why this matched:</strong></p>
    <ul>${htmlReasons}</ul>
    <p><a href="${escapeHtml(input.applyUrl)}">Open job application</a></p>
    <p>Good luck with your applications!</p>
  `;

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerEnv.sendgridApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email: input.toEmail, name: input.toName || undefined }],
          subject: `New HireMePlz match: ${input.role} at ${input.company}`
        }
      ],
      from: { email: workerEnv.sendgridFromEmail, name: "HireMePlz" },
      content: [
        { type: "text/plain", value: text },
        { type: "text/html", value: html }
      ]
    })
  });

  return response.ok;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
