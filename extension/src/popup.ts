const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const emailInput = $<HTMLInputElement>("email");
const passwordInput = $<HTMLInputElement>("password");
const loginBtn = $<HTMLButtonElement>("login-btn");
const loginError = $("login-error");
const apiUrlInput = $<HTMLInputElement>("api-url");
const tokenInput = $<HTMLInputElement>("token");
const saveBtn = $<HTMLButtonElement>("save-btn");
const statusBar = $("status-bar");
const statusText = $("status-text");
const loginView = $("login-view");
const loggedInView = $("logged-in-view");
const userEmail = $("user-email");
const displayApiUrl = $("display-api-url");
const logoutBtn = $<HTMLButtonElement>("logout-btn");

async function getVal(key: string, fallback = ""): Promise<string> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as string | undefined) ?? fallback;
}

async function setVal(key: string, value: string) {
  await chrome.storage.local.set({ [key]: value });
}

function setStatus(connected: boolean, text: string) {
  statusBar.className = `status-bar ${connected ? "connected" : "disconnected"}`;
  statusText.textContent = text;
}

function showError(msg: string) {
  loginError.textContent = msg;
  loginError.style.display = "block";
}

function hideError() {
  loginError.style.display = "none";
}

async function checkState() {
  const apiUrl = await getVal("hiremeplz-api-url", "http://localhost:4000");
  const token = await getVal("hiremeplz-token");
  const email = await getVal("hiremeplz-email");

  apiUrlInput.value = apiUrl;

  if (token) {
    setStatus(true, "Connected");
    loginView.style.display = "none";
    loggedInView.style.display = "block";
    userEmail.textContent = email || "Token configured";
    displayApiUrl.textContent = apiUrl;
  } else {
    setStatus(false, "Not connected");
    loginView.style.display = "block";
    loggedInView.style.display = "none";
  }
}

loginBtn.addEventListener("click", async () => {
  hideError();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const apiUrl = apiUrlInput.value.trim() || "http://localhost:4000";

  if (!email || !password) {
    showError("Please enter email and password");
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    const resp = await fetch(`${apiUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      showError(data.message || "Login failed");
      return;
    }

    await setVal("hiremeplz-api-url", apiUrl);
    await setVal("hiremeplz-token", data.token);
    await setVal("hiremeplz-email", email);
    await checkState();
  } catch {
    showError("Cannot reach server. Check API URL.");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

saveBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim() || "http://localhost:4000";
  const token = tokenInput.value.trim();

  if (!token) {
    showError("Please enter a token");
    return;
  }

  await setVal("hiremeplz-api-url", apiUrl);
  await setVal("hiremeplz-token", token);
  await setVal("hiremeplz-email", "");
  await checkState();
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove([
    "hiremeplz-token",
    "hiremeplz-email",
  ]);
  await checkState();
});

void checkState();
