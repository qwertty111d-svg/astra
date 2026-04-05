(() => {
  const resetBtn = document.getElementById("resetBtn");
  const status = document.getElementById("status");
  const emailInput = document.getElementById("email");

  async function submitReset() {
    const email = String(emailInput?.value || "").trim();
    if (status) {
      status.textContent = "";
      status.className = "status";
    }
    try {
      if (resetBtn) {
        resetBtn.disabled = true;
        resetBtn.textContent = "Отправляем...";
      }
      const response = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось подготовить сброс.");
      if (status) {
        status.textContent = data.message || "Проверь почту.";
        status.className = "status success";
      }
    } catch (error) {
      if (status) {
        status.textContent = error?.message || "Ошибка запроса.";
        status.className = "status";
      }
    } finally {
      if (resetBtn) {
        resetBtn.disabled = false;
        resetBtn.textContent = "Отправить ссылку";
      }
    }
  }

  resetBtn?.addEventListener("click", submitReset);
})();
