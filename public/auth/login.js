(() => {
  const body = document.body;
  const next = body.dataset.next || "/account";
  const turnstileSiteKey = body.dataset.turnstileSiteKey || "";
  const form = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const errorBox = document.getElementById("loginError");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  window.onLoginTurnstileSuccess = (token) => {
    window.__astraLoginTurnstile = token;
  };
  window.onLoginTurnstileExpired = () => {
    window.__astraLoginTurnstile = "";
  };

  if (togglePassword instanceof HTMLElement && passwordInput instanceof HTMLInputElement) {
    togglePassword.addEventListener("click", () => {
      const hidden = passwordInput.type === "password";
      passwordInput.type = hidden ? "text" : "password";
      togglePassword.textContent = hidden ? "✕" : "◐";
    });
  }

  async function submitLogin() {
    const email = String(document.getElementById("email")?.value || "").trim();
    const password = String(document.getElementById("password")?.value || "");
    const website = String(document.getElementById("website")?.value || "");
    const turnstileToken = window.__astraLoginTurnstile || "";

    if (errorBox) errorBox.textContent = "";

    if (turnstileSiteKey && !turnstileToken) {
      if (errorBox) errorBox.textContent = "Сначала пройди антибот-проверку.";
      return;
    }

    try {
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = "Входим...";
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next, website, turnstileToken }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Ошибка входа");

      window.location.href = data.redirectTo || "/account";
    } catch (error) {
      if (errorBox) errorBox.textContent = error?.message || "Ошибка входа";
      if (window.turnstile && turnstileSiteKey) {
        window.__astraLoginTurnstile = "";
        window.turnstile.reset();
      }
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.textContent = "Войти";
      }
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitLogin();
  });
})();
