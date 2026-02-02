// ui.js — FULL (layout + theme + filters + security) with persistence fixes
document.addEventListener("DOMContentLoaded", () => {
  const { state, saveAll, renderAll } = window.Finance;

  const pages = document.querySelectorAll(".page");
  const menuItems = document.querySelectorAll(".menu-item");

  const appEl = document.querySelector(".app");
  const sidebar = document.getElementById("sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebar");
  const toggleThemeBtn = document.getElementById("toggleTheme");

  const themeSelect = document.getElementById("themeSelect");
  const baseCurrencySelect = document.getElementById("baseCurrency");

  const filterDash = document.getElementById("filterAccountDashboard");
  const filterIncome = document.getElementById("filterAccountIncome");
  const filterExpenses = document.getElementById("filterAccountExpenses");

  const lockEnabled = document.getElementById("lockEnabled");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const oldPassword = document.getElementById("oldPassword");
  const newPassword = document.getElementById("newPassword");
  const passwordMsg = document.getElementById("passwordMsg");

  function syncCollapsedClass() {
    if (!sidebar || !appEl) return;
    appEl.classList.toggle("sb-collapsed", sidebar.classList.contains("collapsed"));
  }

  function showPage(pageId) {
    pages.forEach(p => p.classList.add("hidden"));
    document.getElementById(pageId)?.classList.remove("hidden");

    menuItems.forEach(m => m.classList.remove("active"));
    document.querySelector(`.menu-item[data-page="${pageId}"]`)?.classList.add("active");

    if (pageId === "dashboard") window.Finance.renderDashboard();
   if (pageId === "accounts") {
  window.Finance.renderAccounts();
  window.Finance.renderTransfers?.();
}

document.getElementById("analyticsApplyBtn")?.addEventListener("click", () => {
  window.Finance.renderExpensesAnalytics?.();
});

    if (pageId === "income") window.Finance.renderIncome();

    if (pageId === "expenses") {
      // ✅ НЕ скидаємо фільтр завжди, тільки якщо він битий
      const presets = (() => {
        try { return JSON.parse(localStorage.getItem("expensePresets") || "null") || {}; } catch { return {}; }
      })();
      const savedCat = localStorage.getItem("expenseCategoryFilter") || "all";
      if (savedCat !== "all" && !presets[savedCat]) {
        localStorage.setItem("expenseCategoryFilter", "all");
        window.Finance.state.settings.expenseCategoryFilter = "all";
      }
      window.Finance.renderExpenseCategoryFilters();
      window.Finance.renderExpenses();
    }

    if (pageId === "capital") window.Finance.renderCapital();
    if (pageId === "goals") window.Finance.renderGoals();
    if (pageId === "credits") window.Finance.renderCredits();
    if (pageId === "assets") window.Finance.renderAssets();
    if (pageId === "forecast") window.Finance.renderForecast();
  }

  menuItems.forEach(item => item.addEventListener("click", () => showPage(item.dataset.page)));

  toggleSidebarBtn?.addEventListener("click", () => {
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed");
    syncCollapsedClass();
  });

  function autoCollapseSidebar() {
    if (!sidebar) return;
    if (window.innerWidth < 900) sidebar.classList.add("collapsed");
    else sidebar.classList.remove("collapsed");
    syncCollapsedClass();
  }
  window.addEventListener("resize", autoCollapseSidebar);

  function applyTheme(theme) {
    document.body.className = theme;
    if (toggleThemeBtn) toggleThemeBtn.textContent = theme === "light" ? "🌙" : "☀️";
    state.settings.theme = theme;
    saveAll();
  }
  toggleThemeBtn?.addEventListener("click", () => {
    applyTheme(document.body.classList.contains("light") ? "dark" : "light");
  });
  if (themeSelect) {
    themeSelect.value = state.settings.theme;
    themeSelect.addEventListener("change", e => applyTheme(e.target.value));
  }

  if (baseCurrencySelect) {
    baseCurrencySelect.value = state.settings.baseCurrency;
    baseCurrencySelect.addEventListener("change", e => {
      state.settings.baseCurrency = e.target.value;
      saveAll();
      renderAll();
    });
  }

  filterDash?.addEventListener("change", () => window.Finance.renderDashboard());
  filterIncome?.addEventListener("change", () => window.Finance.renderIncome());
  filterExpenses?.addEventListener("change", () => window.Finance.renderExpenses());

  function msg(text, color = "green") {
    if (!passwordMsg) return;
    passwordMsg.textContent = text;
    passwordMsg.style.color = color;
  }

  if (lockEnabled) {
    lockEnabled.checked = !!state.settings.lockEnabled;
    lockEnabled.addEventListener("change", () => {
      state.settings.lockEnabled = lockEnabled.checked;
      saveAll();
      msg(state.settings.lockEnabled ? "Захист паролем увімкнено" : "Захист паролем вимкнено", "#2f80ed");
      window.Auth?.authFlow?.();
    });
  }

  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", () => {
      msg("");
      const saved = localStorage.getItem("financePassword");
      if (!saved) return msg("Пароль ще не створено. Увімкни захист — і створи пароль при вході.", "orange");
      if (oldPassword.value !== saved) return msg("Старий пароль невірний", "red");

      const newP = newPassword.value.trim();
      if (newP.length < 4) return msg("Новий пароль мінімум 4 символи", "red");

      localStorage.setItem("financePassword", newP);
      oldPassword.value = "";
      newPassword.value = "";
      msg("Пароль змінено успішно ✅", "green");
    });
  }

  window.addEventListener("expensePresetsChanged", () => {
    window.Finance.renderExpenseCategoryFilters?.();
    window.Finance.renderExpenses?.();
    window.Finance.renderExpensesAnalytics?.();
  });

  applyTheme(state.settings.theme || "light");
  renderAll();
  autoCollapseSidebar();
  syncCollapsedClass();
  showPage("dashboard");
});
