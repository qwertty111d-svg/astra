(() => {
  const token = document.body.dataset.token || "";
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const newPassword = document.getElementById("newPassword");
  const repeatPassword = document.getElementById("repeatPassword");
  const toggleNew = document.getElementById("toggleNew");
  const toggleRepeat = document.getElementById("toggleRepeat");

  function attachToggle(button, input) {
    if (!(button instanceof HTMLElement) || !(input instanceof HTMLInputElement)) return;
    button.addEventListener("click", () => {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      button.textContent = hidden ? "✕" : "◐";
    });
  }

  attachToggle(toggleNew, newPassword);
  attachToggle(toggleRepeat, repeatPassword);

  async function submitReset() {
    const password = String(newPassword?.value || "");
    const repeat = String(repeatPassword?.value || "");

    if (status) {
      status.textContent = "";
      status.className = "status";
    }

    if (!token) {
      if (status) status.textContent = "Ссылка недействительна.";
      return;
    }
    if (!password || password.length < 8) {
      if (status) status.textContent = "Пароль должен быть не короче 8 символов.";
      return;
    }
    if (password !== repeat) {
      if (status) status.textContent = "Пароли не совпадают.";
      return;
    }

    try {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Сохраняем...";
      }
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось обновить пароль.");
      if (status) {
        status.textContent = data.message || "Пароль обновлён.";
        status.className = "status success";
      }
      window.setTimeout(() => {
        window.location.href = data.redirectTo || "/login";
      }, 800);
    } catch (error) {
      if (status) {
        status.textContent = error?.message || "Ошибка обновления пароля.";
        status.className = "status";
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Сохранить пароль";
      }
    }
  }

  saveBtn?.addEventListener("click", submitReset);
})();
