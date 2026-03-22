const $ = (id: string) => document.getElementById(id)!;

const loginView = $("login-view");
const loggedInView = $("logged-in-view") as HTMLElement;
const nameLabel = $("name-label") as HTMLElement;
const nameInput = $("name") as HTMLInputElement;
const emailInput = $("email") as HTMLInputElement;
const passwordInput = $("password") as HTMLInputElement;
const loginBtn = $("login-btn") as HTMLButtonElement;
const loginMsg = $("login-msg") as HTMLElement;
const authToggleBtn = $("auth-toggle-btn") as HTMLButtonElement;
const userEmail = $("user-email");
const apiUrlInput = $("api-url") as HTMLInputElement;
const serverStatus = $("server-status");
const saveSettingsBtn = $("save-settings-btn");
const logoutBtn = $("logout-btn");
const settingsMsg = $("settings-msg");

let authMode: "login" | "register" = "login";

async function getStorage<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

async function setStorage(data: Record<string, unknown>) {
  await chrome.storage.local.set(data);
}

function showMsg(el: HTMLElement, text: string, type: "error" | "success") {
  el.className = `msg msg-${type}`;
  el.textContent = text;
  setTimeout(() => { el.textContent = ""; el.className = ""; }, 3000);
}

async function checkServer(apiUrl: string) {
  try {
    const res = await fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      serverStatus.innerHTML = '<span class="status-dot green"></span> Server connected';
    } else {
      serverStatus.innerHTML = '<span class="status-dot red"></span> Server returned error';
    }
  } catch {
    serverStatus.innerHTML = '<span class="status-dot red"></span> Cannot reach server';
  }
}

async function init() {
  const token = await getStorage("hiremeplz-token", "");
  const email = await getStorage("hiremeplz-email", "");
  const apiUrl = await getStorage("hiremeplz-api-url", "http://localhost:4000");

  apiUrlInput.value = apiUrl;
  checkServer(apiUrl);

  if (token) {
    loginView.style.display = "none";
    loggedInView.style.display = "block";
    userEmail.textContent = email || "Logged in";
  } else {
    loginView.style.display = "block";
    loggedInView.style.display = "none";
    renderAuthMode();
  }
}

function renderAuthMode() {
  const isRegister = authMode === "register";
  nameLabel.style.display = isRegister ? "block" : "none";
  nameInput.style.display = isRegister ? "block" : "none";
  loginBtn.textContent = isRegister ? "Create Account" : "Sign In";
  authToggleBtn.textContent = isRegister ? "Back to sign in" : "Create account";
}

async function handleLogin() {
  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showMsg(loginMsg, "Please enter email and password.", "error");
    return;
  }

  if (authMode === "register" && !name) {
    showMsg(loginMsg, "Please enter your name.", "error");
    return;
  }

  // Use the value currently shown in the input field, falling back to storage
  const apiUrl = apiUrlInput.value.trim() || await getStorage("hiremeplz-api-url", "http://localhost:4000");
  // Persist whatever URL was used so future calls are consistent
  await setStorage({ "hiremeplz-api-url": apiUrl });

  try {
    const endpoint =
      authMode === "register" ? `${apiUrl}/api/auth/register` : `${apiUrl}/api/auth/login`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        authMode === "register" ? { name, email, password } : { email, password }
      ),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.message || "Login failed";
      // Show URL in error so user can confirm which server was hit
      showMsg(loginMsg, `${msg} (server: ${apiUrl})`, "error");
      return;
    }

    await setStorage({
      "hiremeplz-token": data.token,
      "hiremeplz-email": email,
    });

    showMsg(
      loginMsg,
      authMode === "register" ? "Account created!" : "Logged in!",
      "success"
    );
    setTimeout(() => init(), 500);
  } catch {
    showMsg(loginMsg, "Cannot connect to server. Check API Server above.", "error");
  }
}

loginBtn.addEventListener("click", () => {
  void handleLogin();
});

authToggleBtn.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  loginMsg.textContent = "";
  renderAuthMode();
});

[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleLogin();
    }
  });
});

saveSettingsBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim() || "http://localhost:4000";
  await setStorage({ "hiremeplz-api-url": apiUrl });
  showMsg(settingsMsg, "Settings saved!", "success");
  checkServer(apiUrl);
});

logoutBtn.addEventListener("click", async () => {
  await chrome.storage.local.remove(["hiremeplz-token", "hiremeplz-email"]);
  init();
});

// Manual token save (dist popup.html uses save-btn + token input)
const saveBtnEl = document.getElementById("save-btn");
const tokenInputEl = document.getElementById("token") as HTMLInputElement | null;
if (saveBtnEl && tokenInputEl) {
  saveBtnEl.addEventListener("click", async () => {
    const apiUrl = apiUrlInput.value.trim() || "http://localhost:4000";
    const token = tokenInputEl.value.trim();
    await setStorage({ "hiremeplz-api-url": apiUrl });
    if (token) {
      await setStorage({ "hiremeplz-token": token });
    }
    checkServer(apiUrl);
    setTimeout(() => init(), 300);
  });
}

init();
