(() => {
  const body = document.body;
  const turnstileSiteKey = body.dataset.turnstileSiteKey || "";
  const form = document.getElementById("registerForm");
  const verifyStep = document.getElementById("verifyStep");
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const resendBtn = document.getElementById("resendBtn");
  const verifyBtn = document.getElementById("verifyBtn");
  const status = document.getElementById("status");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const websiteInput = document.getElementById("website");
  const togglePassword = document.getElementById("togglePassword");
  const codeInputs = Array.from(document.querySelectorAll(".js-reg-code"));

  let cooldown = 0;
  let cooldownTimer = null;

  window.onRegisterTurnstileSuccess = (token) => {
    window.__astraRegisterTurnstile = token;
  };
  window.onRegisterTurnstileExpired = () => {
    window.__astraRegisterTurnstile = "";
  };

  if (togglePassword instanceof HTMLElement && passwordInput instanceof HTMLInputElement) {
    togglePassword.addEventListener("click", () => {
      const hidden = passwordInput.type === "password";
      passwordInput.type = hidden ? "text" : "password";
      togglePassword.textContent = hidden ? "✕" : "◐";
    });
  }

  function setStatus(text, type = "") {
    if (!status) return;
    status.textContent = text;
    status.className = `status ${type}`.trim();
  }

  function updateResendButton() {
    if (!(resendBtn instanceof HTMLButtonElement)) return;
    resendBtn.disabled = cooldown > 0;
    resendBtn.textContent = cooldown > 0 ? `Повтор через ${cooldown}с` : "Отправить код ещё раз";
  }

  function startCooldown(seconds = 45) {
    cooldown = seconds;
    updateResendButton();
    clearInterval(cooldownTimer);
    cooldownTimer = setInterval(() => {
      cooldown -= 1;
      updateResendButton();
      if (cooldown <= 0) clearInterval(cooldownTimer);
    }, 1000);
  }

  codeInputs.forEach((input, index) => {
    input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(-1);
      if (input.value && codeInputs[index + 1]) codeInputs[index + 1].focus();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Backspace" && !input.value && codeInputs[index - 1]) codeInputs[index - 1].focus();
      if (event.key === "ArrowLeft" && codeInputs[index - 1]) codeInputs[index - 1].focus();
      if (event.key === "ArrowRight" && codeInputs[index + 1]) codeInputs[index + 1].focus();
    });
    input.addEventListener("paste", (event) => {
      const pasted = (event.clipboardData?.getData("text") || "").replace(/\D/g, "").slice(0, codeInputs.length);
      if (!pasted) return;
      event.preventDefault();
      pasted.split("").forEach((char, i) => {
        if (codeInputs[i]) codeInputs[i].value = char;
      });
      codeInputs[Math.min(pasted.length - 1, codeInputs.length - 1)]?.focus();
    });
  });

  function getCodeValue() {
    return codeInputs.map((input) => input.value).join("");
  }

  async function sendCode() {
    const name = String(nameInput?.value || "").trim();
    const email = String(emailInput?.value || "").trim();
    const password = String(passwordInput?.value || "");
    const website = String(websiteInput?.value || "");
    const turnstileToken = window.__astraRegisterTurnstile || "";

    setStatus("");

    if (turnstileSiteKey && !turnstileToken) {
      setStatus("Сначала пройди антибот-проверку.");
      return;
    }

    try {
      if (sendCodeBtn) {
        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = "Отправляем...";
      }
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, website, turnstileToken }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось отправить код.");
      verifyStep?.classList.add("is-open");
      setStatus(data.message || "Код отправлен. Проверь почту.", "success");
      startCooldown(45);
    } catch (error) {
      setStatus(error?.message || "Ошибка отправки кода.");
      if (window.turnstile && turnstileSiteKey) {
        window.__astraRegisterTurnstile = "";
        window.turnstile.reset();
      }
    } finally {
      if (sendCodeBtn) {
        sendCodeBtn.disabled = false;
        sendCodeBtn.textContent = "Получить код";
      }
    }
  }

  async function verifyCode() {
    const email = String(emailInput?.value || "").trim();
    const code = getCodeValue();
    if (code.length !== 6) {
      setStatus("Введи 6-значный код.");
      return;
    }

    try {
      if (verifyBtn) {
        verifyBtn.disabled = true;
        verifyBtn.textContent = "Подтверждаем...";
      }
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось подтвердить email.");
      setStatus("Аккаунт создан. Перенаправляем...", "success");
      window.setTimeout(() => {
        window.location.href = data.redirectTo || "/account";
      }, 700);
    } catch (error) {
      setStatus(error?.message || "Ошибка подтверждения.");
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = "Подтвердить email";
      }
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    sendCode();
  });
  verifyBtn?.addEventListener("click", verifyCode);
  resendBtn?.addEventListener("click", sendCode);
})();
