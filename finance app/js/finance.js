// finance.js — Release 1.7 FULL (CLEAN + FIXED)
// Includes:
// - stable state + saveAll
// - initialBalance + recalculateBalances (with goals.saved recalc from "Цілі" expenses)
// - CRUD: edit/delete incomes/expenses
// - accounts: deleteAccount
// - transfers: add/delete + render history + balances impact
// - analytics: expenses page analytics (expensesByCategoryChart) + dashboard analytics (dashExpenseCatChart)
// - goals archive

// ===== one-time: move "expense-like" rows from incomes -> expenses (safe heuristic) =====
(function fixMixedIncomeExpense() {
  try {
    const incomes = JSON.parse(localStorage.getItem("incomes") || "[]");
    const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
    if (!Array.isArray(incomes) || !Array.isArray(expenses)) return;

    let movedCount = 0;
    const kept = [];

    for (const item of incomes) {
      const cat = (item?.category || "").toString();
      const hasSlash = cat.includes("/");
      const hasSub = item?.subcategory != null;

      if (hasSlash || hasSub) {
        const parts = cat.split("/").map(s => s.trim()).filter(Boolean);
        const category = parts[0] || cat || "Інше";
        const subcategory = parts[1] || item.subcategory || "";
        expenses.push({
          id: item.id || Date.now(),
          amount: Number(item.amount || 0),
          category,
          subcategory,
          accountId: Number(item.accountId || 0),
          date: item.date || new Date().toISOString()
        });
        movedCount++;
      } else {
        kept.push(item);
      }
    }

    if (movedCount) {
      localStorage.setItem("incomes", JSON.stringify(kept));
      localStorage.setItem("expenses", JSON.stringify(expenses));
    }
  } catch {}
})();

(function () {
  function safeJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  const DEFAULT_PRESETS = {
    "Їжа": ["Продукти","Кафе/Ресторани","Доставка","Інше"],
    "Авто": ["Пальне","Ремонт","Страхування","Інше"],
    "Дім": ["Комуналка","Оренда","Ремонт","Інше"],
    "Здоровʼя": ["Аптека","Лікарі","Інше"],
    "Розваги": ["Кіно","Підписки","Інше"],
    "Одяг": ["Одяг","Взуття","Інше"],
    "Цілі": ["Внесок у ціль"],
    "Інше": ["Інше"]
  };

  const lockEnabledInit = (localStorage.getItem("lockEnabled") === null)
    ? false
    : (localStorage.getItem("lockEnabled") === "true");

  // ===== STATE =====
  const state = {
    settings: {
      baseCurrency: localStorage.getItem("baseCurrency") || "UAH",
      theme: localStorage.getItem("theme") || "light",
      lockEnabled: lockEnabledInit,
      expenseCategoryFilter: localStorage.getItem("expenseCategoryFilter") || "all"
    },
    accounts: safeJSON("accounts", null) || [
      { id: 1, name: "Готівка UAH", type: "cash", currency: "UAH", balance: 0 },
      { id: 2, name: "Готівка USD", type: "cash", currency: "USD", balance: 0 },
      { id: 3, name: "Готівка EUR", type: "cash", currency: "EUR", balance: 0 },
      { id: 4, name: "Карта", type: "card", currency: "UAH", balance: 0 }
    ],
    incomes: safeJSON("incomes", []),
    expenses: safeJSON("expenses", []),
    capital: safeJSON("capital", []),
    goals: safeJSON("goals", []),
    goalsArchive: safeJSON("goalsArchive", []),
    credits: safeJSON("credits", []),
    assets: safeJSON("assets", []),

    // transfers
    transfers: safeJSON("transfers", [])
  };

  window.appState = state;

  // ===== Helpers =====
  function fmt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return "0.00";
    return x.toFixed(2);
  }

  function parseISODateOnly(s) {
    if (!s) return "";
    if (typeof s !== "string") return "";
    return s.slice(0, 10);
  }

  function inDateRange(isoDate, from, to) {
    const d = parseISODateOnly(isoDate);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  function getFromTo(prefix) {
    const from = document.getElementById(prefix + "From")?.value || "";
    const to = document.getElementById(prefix + "To")?.value || "";
    return { from, to };
  }

  function convert(amount, fromCur, toCur) {
    const rates = { UAH: 1, USD: 0.027, EUR: 0.025 };
    const fr = rates[fromCur] ?? 1;
    const tr = rates[toCur] ?? 1;
    return (Number(amount) / fr) * tr;
  }

  function accountName(id) {
    const a = state.accounts.find(x => x.id === Number(id));
    return a ? a.name : "—";
  }

  function buildAccountFilterOptions(selectEl, withAll = true) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = "";

    if (withAll) {
      const optAll = document.createElement("option");
      optAll.value = "all";
      optAll.textContent = "Всі рахунки";
      selectEl.appendChild(optAll);
    }

    state.accounts.forEach(a => {
      const opt = document.createElement("option");
      opt.value = String(a.id);
      opt.textContent = a.name;
      selectEl.appendChild(opt);
    });

    if ([...selectEl.options].some(o => o.value === prev)) selectEl.value = prev;
  }

  // ensures presets exist and contain "Цілі"
  function getExpensePresets() {
    const p = safeJSON("expensePresets", null);

    if (!p || Object.keys(p).length === 0) {
      localStorage.setItem("expensePresets", JSON.stringify(DEFAULT_PRESETS));
      return DEFAULT_PRESETS;
    }

    if (!p["Цілі"]) {
      p["Цілі"] = ["Внесок у ціль"];
      localStorage.setItem("expensePresets", JSON.stringify(p));
      window.dispatchEvent(new Event("expensePresetsChanged"));
    }

    if (!p["Інше"]) {
      p["Інше"] = ["Інше"];
      localStorage.setItem("expensePresets", JSON.stringify(p));
      window.dispatchEvent(new Event("expensePresetsChanged"));
    }

    return p;
  }

  // ===== Persistence =====
  function saveAll() {
    localStorage.setItem("accounts", JSON.stringify(state.accounts));
    localStorage.setItem("incomes", JSON.stringify(state.incomes));
    localStorage.setItem("expenses", JSON.stringify(state.expenses));
    localStorage.setItem("capital", JSON.stringify(state.capital));
    localStorage.setItem("goals", JSON.stringify(state.goals));
    localStorage.setItem("goalsArchive", JSON.stringify(state.goalsArchive));
    localStorage.setItem("credits", JSON.stringify(state.credits));
    localStorage.setItem("assets", JSON.stringify(state.assets));
    localStorage.setItem("transfers", JSON.stringify(state.transfers || []));

    localStorage.setItem("theme", state.settings.theme);
    localStorage.setItem("baseCurrency", state.settings.baseCurrency);
    localStorage.setItem("lockEnabled", String(state.settings.lockEnabled));
    localStorage.setItem("expenseCategoryFilter", state.settings.expenseCategoryFilter || "all");
  }

  // ===== 1.7 Core: initialBalance + recalc =====
  function ensureInitialBalances() {
    state.accounts.forEach(a => {
      if (a.initialBalance === undefined || a.initialBalance === null || !Number.isFinite(Number(a.initialBalance))) {
        a.initialBalance = Number(a.balance || 0);
      }
      a.balance = Number(a.balance || 0);
      a.initialBalance = Number(a.initialBalance || 0);
    });
  }

  function recalculateBalances() {
    ensureInitialBalances();

    // reset to baseline
    state.accounts.forEach(a => {
      a.balance = Number(a.initialBalance || 0);
    });

    // apply incomes
    state.incomes.forEach(i => {
      const acc = state.accounts.find(a => a.id === Number(i.accountId || 0));
      if (!acc) return;
      acc.balance += Number(i.amount || 0);
    });

    // apply expenses
    state.expenses.forEach(e => {
      const acc = state.accounts.find(a => a.id === Number(e.accountId || 0));
      if (!acc) return;
      acc.balance -= Number(e.amount || 0);
    });

    // apply transfers
    (state.transfers || []).forEach(t => {
      const from = state.accounts.find(a => a.id === Number(t.fromAccountId || 0));
      const to = state.accounts.find(a => a.id === Number(t.toAccountId || 0));
      const amt = Number(t.amount || 0);
      if (!amt || !from || !to) return;
      from.balance -= amt;
      to.balance += amt;
    });

    // ===== Recalculate goals.saved from "Цілі" expenses (edit/delete safe) =====
    const savedMap = {};
    state.expenses.forEach(e => {
      if (e.category !== "Цілі") return;
      const m = String(e.subcategory || "").match(/id:([^ ]+)/);
      const goalId = m ? m[1] : null;
      if (!goalId) return;
      savedMap[goalId] = (savedMap[goalId] || 0) + Number(e.amount || 0);
    });

    state.goals.forEach(g => {
      const gid = String(g.id);
      if (g.initialSaved === undefined || g.initialSaved === null || !Number.isFinite(Number(g.initialSaved))) {
        g.initialSaved = Number(g.saved || 0);
      }
      g.saved = Number(g.initialSaved || 0) + Number(savedMap[gid] || 0);
    });
  }

  // ===== CRUD: incomes/expenses =====
  function deleteIncome(id) {
    const before = state.incomes.length;
    state.incomes = state.incomes.filter(x => String(x.id) !== String(id));
    if (state.incomes.length === before) return false;
    recalculateBalances();
    saveAll();
    return true;
  }

  function deleteExpense(id) {
    const before = state.expenses.length;
    state.expenses = state.expenses.filter(x => String(x.id) !== String(id));
    if (state.expenses.length === before) return false;
    recalculateBalances();
    saveAll();
    return true;
  }

  function upsertIncome(item) {
    const idx = state.incomes.findIndex(x => String(x.id) === String(item.id));
    if (idx >= 0) state.incomes[idx] = item;
    else state.incomes.push(item);
    recalculateBalances();
    saveAll();
  }

  function upsertExpense(item) {
    const idx = state.expenses.findIndex(x => String(x.id) === String(item.id));
    if (idx >= 0) state.expenses[idx] = item;
    else state.expenses.push(item);
    recalculateBalances();
    saveAll();
  }

  // ===== Accounts: delete account =====
  function deleteAccount(accountId) {
    const before = state.accounts.length;
    state.accounts = state.accounts.filter(a => a.id !== Number(accountId));
    if (state.accounts.length === before) return false;

    state.incomes  = state.incomes.filter(x => Number(x.accountId) !== Number(accountId));
    state.expenses = state.expenses.filter(x => Number(x.accountId) !== Number(accountId));
    state.capital  = state.capital.filter(x => Number(x.accountId) !== Number(accountId));

    state.transfers = (state.transfers || []).filter(t =>
      Number(t.fromAccountId) !== Number(accountId) && Number(t.toAccountId) !== Number(accountId)
    );

    recalculateBalances();
    saveAll();
    return true;
  }

  // ===== Transfers =====
  function deleteTransfer(id) {
    const before = (state.transfers || []).length;
    state.transfers = (state.transfers || []).filter(t => String(t.id) !== String(id));
    if ((state.transfers || []).length === before) return false;

    recalculateBalances();
    saveAll();
    return true;
  }

  function renderTransfers() {
    const list = document.getElementById("transfersList");
    if (!list) return;

    list.innerHTML = "";
    const rows = (state.transfers || []).slice().reverse();

    if (!rows.length) {
      const li = document.createElement("li");
      li.style.opacity = "0.75";
      li.textContent = "Переказів поки немає";
      list.appendChild(li);
      return;
    }

    rows.forEach(t => {
      const d = parseISODateOnly(t.date);
      const fromName = accountName(t.fromAccountId);
      const toName = accountName(t.toAccountId);
      const note = t.note ? ` • ${t.note}` : "";

      const li = document.createElement("li");
      li.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="min-width:0;">
            ${d ? d + " • " : ""}<b>${fromName}</b> → <b>${toName}</b>: ${fmt(t.amount)}${note}
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button class="btn-mini" data-del-transfer="${t.id}">🗑</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });

    list.onclick = (e) => {
      const delBtn = e.target.closest("[data-del-transfer]");
      if (!delBtn) return;

      const id = delBtn.getAttribute("data-del-transfer");
      if (!confirm("Видалити переказ?")) return;

      deleteTransfer(id);
      renderAll();
    };
  }

  // ===== Goals archive helpers =====
  function moveGoalToArchive(goalId, completedAtISO) {
    const idx = state.goals.findIndex(g => String(g.id) === String(goalId));
    if (idx === -1) return false;

    const g = state.goals[idx];
    state.goals.splice(idx, 1);

    state.goalsArchive = Array.isArray(state.goalsArchive) ? state.goalsArchive : [];
    state.goalsArchive.unshift({
      ...g,
      completedAt: completedAtISO || new Date().toISOString()
    });

    saveAll();
    return true;
  }

  function autoArchiveCompletedGoals() {
    const nowISO = new Date().toISOString();
    const active = [];
    const moved = [];

    state.goals.forEach(g => {
      const saved = Number(g.saved) || 0;
      const target = Math.max(1, Number(g.target) || 1);
      if (saved >= target) moved.push(g);
      else active.push(g);
    });

    if (!moved.length) return false;

    state.goals = active;
    state.goalsArchive = Array.isArray(state.goalsArchive) ? state.goalsArchive : [];
    moved.forEach(g => state.goalsArchive.unshift({ ...g, completedAt: g.completedAt || nowISO }));

    saveAll();
    return true;
  }

  // ===== Renders =====
  function renderExpenseCategoryFilters() {
    const box = document.getElementById("expenseCatFilters");
    if (!box) return;

    const presets = getExpensePresets();
    const cats = Object.keys(presets);

    box.innerHTML = "";
    const current = state.settings.expenseCategoryFilter || "all";

    const allChip = document.createElement("div");
    allChip.className = "chip" + (current === "all" ? " active" : "");
    allChip.textContent = "Всі";
    allChip.onclick = () => {
      state.settings.expenseCategoryFilter = "all";
      localStorage.setItem("expenseCategoryFilter", "all");
      renderExpenseCategoryFilters();
      renderExpenses();
    };
    box.appendChild(allChip);

    cats.forEach(cat => {
      const chip = document.createElement("div");
      chip.className = "chip" + (current === cat ? " active" : "");
      chip.textContent = cat;
      chip.onclick = () => {
        state.settings.expenseCategoryFilter = cat;
        localStorage.setItem("expenseCategoryFilter", cat);
        renderExpenseCategoryFilters();
        renderExpenses();
      };
      box.appendChild(chip);
    });
  }

  function renderAccounts() {
    const list = document.getElementById("accountsList");
    if (!list) return;
    list.innerHTML = "";

    const wrap = document.createElement("div");
    wrap.className = "acc-grid";

    state.accounts.forEach(a => {
      const badge =
        a.currency === "UAH" ? "₴" :
        a.currency === "USD" ? "$" :
        a.currency === "EUR" ? "€" : "💳";

      const card = document.createElement("div");
      card.className = "acc-card2";
      card.innerHTML = `
        <div class="acc-row">
          <div class="acc-left">
            <div class="acc-badge">${badge}</div>
            <div class="acc-name" title="${a.name}">${a.name}</div>
          </div>
          <div class="acc-balance">${fmt(a.balance)} ${a.currency}</div>
        </div>

        <div class="acc-actions" style="justify-content:flex-end;">
          <button class="btn-mini" data-act="del-account" data-id="${a.id}" title="Видалити рахунок">🗑 Видалити</button>
        </div>
      `;
      wrap.appendChild(card);
    });

    list.appendChild(wrap);

    list.onclick = (e) => {
      const btn = e.target.closest("[data-act='del-account']");
      if (!btn) return;

      const id = Number(btn.getAttribute("data-id") || 0);
      if (!id) return;

      if (!confirm("Видалити рахунок? Будуть також видалені всі операції цього рахунку (доходи/витрати/капітал/перекази).")) return;

      deleteAccount(id);
      renderAll();
    };
  }

  function renderIncome() {
    const list = document.getElementById("incomeList");
    if (!list) return;

    const filter = document.getElementById("filterAccountIncome");
    const selected = filter?.value ? filter.value : "all";
    const { from, to } = getFromTo("inc");

    list.innerHTML = "";

    const rows = state.incomes.slice().reverse()
      .filter(i => selected === "all" ? true : String(i.accountId) === selected)
      .filter(i => (!from && !to) ? true : inDateRange(i.date, from, to));

    rows.forEach(i => {
      const d = parseISODateOnly(i.date);
      const li = document.createElement("li");
      li.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="min-width:0;">
            ${d ? d + " • " : ""}<b>${i.category}</b>: ${fmt(i.amount)} (${accountName(i.accountId)})
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button class="btn-mini" data-edit-income="${i.id}">✏️</button>
            <button class="btn-mini" data-del-income="${i.id}">🗑</button>
          </div>
        </div>
      `;
      list.appendChild(li);
    });

    list.onclick = (e) => {
      const delBtn = e.target.closest("[data-del-income]");
      const editBtn = e.target.closest("[data-edit-income]");

      if (delBtn) {
        const id = delBtn.getAttribute("data-del-income");
        if (confirm("Видалити дохід?")) {
          deleteIncome(id);
          renderAll();
        }
        return;
      }

      if (editBtn) {
        const id = editBtn.getAttribute("data-edit-income");
        window.Finance.openEditIncome?.(id);
      }
    };
  }

  function renderExpenses() {
    const list = document.getElementById("expensesList");
    if (!list) return;

    const accountFilter = document.getElementById("filterAccountExpenses");
    const selectedAcc = accountFilter?.value ? accountFilter.value : "all";
    const catFilter = state.settings.expenseCategoryFilter || "all";
    const { from, to } = getFromTo("exp");

    list.innerHTML = "";

    const rows = state.expenses.slice().reverse()
      .filter(e => selectedAcc === "all" ? true : String(e.accountId) === selectedAcc)
      .filter(e => catFilter === "all" ? true : e.category === catFilter)
      .filter(e => (!from && !to) ? true : inDateRange(e.date, from, to));

    rows.forEach(e => {
      const sub = e.subcategory ? ` / ${e.subcategory}` : "";
      const d = parseISODateOnly(e.date);
      const li = document.createElement("li");

      li.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <div style="min-width:0;">
            ${d ? d + " • " : ""}<b>${e.category}${sub}</b>: ${fmt(e.amount)} (${accountName(e.accountId)})
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;">
            <button class="btn-mini" data-edit-expense="${e.id}">✏️</button>
            <button class="btn-mini" data-del-expense="${e.id}">🗑</button>
          </div>
        </div>
      `;

      list.appendChild(li);
    });

    list.onclick = (e) => {
      const delBtn = e.target.closest("[data-del-expense]");
      const editBtn = e.target.closest("[data-edit-expense]");

      if (delBtn) {
        const id = delBtn.getAttribute("data-del-expense");
        if (confirm("Видалити витрату?")) {
          deleteExpense(id);
          renderAll();
        }
        return;
      }

      if (editBtn) {
        const id = editBtn.getAttribute("data-edit-expense");
        window.Finance.openEditExpense?.(id);
      }
    };
  }

  function renderCapital() {
    const list = document.getElementById("capitalList");
    if (!list) return;
    list.innerHTML = "";
    state.capital.slice().reverse().forEach(c => {
      const li = document.createElement("li");
      li.textContent = `${c.name}: ${fmt(c.amount)} (${accountName(c.accountId)})`;
      list.appendChild(li);
    });
  }

  function renderGoals() {
    autoArchiveCompletedGoals();

    const list = document.getElementById("goalsList");
    if (!list) return;
    list.innerHTML = "";

    const activeWrap = document.createElement("div");
    activeWrap.className = "goals-active-wrap";

    state.goals.forEach(g => {
      const saved = Number(g.saved) || 0;
      const target = Math.max(1, Number(g.target) || 1);
      const percent = Math.min(100, Math.round((saved / target) * 100));

      const li = document.createElement("li");
      li.innerHTML = `
        <div class="goal-item">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
            <strong>${g.name}</strong>
            <button class="btn-mini" data-goal-act="archive" data-id="${g.id}">✅ В архів</button>
          </div>
          <div class="goal-bar"><div class="goal-progress" style="width:${percent}%"></div></div>
          <small>${fmt(saved)} / ${fmt(target)} (${percent}%)</small>
        </div>
      `;
      activeWrap.appendChild(li);
    });

    list.appendChild(activeWrap);

    const archiveBox = document.getElementById("goalsArchiveList");
    const hasSeparateArchive = !!archiveBox;

    const archiveData = Array.isArray(state.goalsArchive) ? state.goalsArchive : [];
    const archiveContainer = hasSeparateArchive ? archiveBox : document.createElement("div");
    if (!hasSeparateArchive) {
      archiveContainer.className = "goals-archive-inline";
      archiveContainer.style.marginTop = "12px";
    }

    archiveContainer.innerHTML = "";

    const title = document.createElement("div");
    title.className = "section-title";
    title.innerHTML = `<strong>Архів цілей</strong> <small style="opacity:.7;">(${archiveData.length})</small>`;
    archiveContainer.appendChild(title);

    if (!archiveData.length) {
      const empty = document.createElement("div");
      empty.style.opacity = "0.7";
      empty.style.marginTop = "6px";
      empty.textContent = "Поки що архів порожній";
      archiveContainer.appendChild(empty);
    } else {
      const ul = document.createElement("ul");
      ul.style.marginTop = "8px";
      ul.style.paddingLeft = "18px";

      archiveData.forEach(g => {
        const saved = Number(g.saved) || 0;
        const target = Math.max(1, Number(g.target) || 1);
        const completedAt = parseISODateOnly(g.completedAt || "");
        const li = document.createElement("li");
        li.textContent = `${g.name}: ${fmt(saved)} / ${fmt(target)} ${completedAt ? "• " + completedAt : ""}`;
        ul.appendChild(li);
      });

      archiveContainer.appendChild(ul);
    }

    if (!hasSeparateArchive) list.appendChild(archiveContainer);

    list.querySelectorAll("[data-goal-act='archive']").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        moveGoalToArchive(id, new Date().toISOString());
        renderGoals();
      });
    });
  }

  function renderCredits() {
    const list = document.getElementById("creditsList");
    if (!list) return;
    list.innerHTML = "";
    state.credits.slice().reverse().forEach(c => {
      const monthly = (Number(c.amount) / Math.max(1, Number(c.payments))).toFixed(2);
      const li = document.createElement("li");
      li.textContent = `${c.name}: ${fmt(c.amount)} • платежів: ${c.payments} • ~${monthly}/міс • старт: ${c.start || "-"}`;
      list.appendChild(li);
    });
  }

  function renderAssets() {
    const list = document.getElementById("assetsList");
    if (!list) return;
    list.innerHTML = "";
    state.assets.slice().reverse().forEach(a => {
      const li = document.createElement("li");
      li.textContent = `${a.type}: ${a.name} • ${fmt(a.amount)} ${a.currency} • ${a.trend}`;
      list.appendChild(li);
    });
  }

  function renderDashboard() {
    const out = document.getElementById("dashboardContent");
    if (!out) return;

    const base = state.settings.baseCurrency;
    const filter = document.getElementById("filterAccountDashboard");
    const selected = filter?.value ? filter.value : "all";
    const from = document.getElementById("dashFrom")?.value || "";
    const to = document.getElementById("dashTo")?.value || "";

    const accountsFiltered = state.accounts.filter(a => selected === "all" ? true : String(a.id) === selected);
    const totalAccounts = accountsFiltered.reduce((s, a) => s + convert(a.balance, a.currency, base), 0);

    const totalIncome = state.incomes
      .filter(i => selected === "all" ? true : String(i.accountId) === selected)
      .filter(i => (!from && !to) ? true : inDateRange(i.date, from, to))
      .reduce((s, i) => {
        const acc = state.accounts.find(a => a.id === i.accountId);
        return s + convert(i.amount, acc?.currency || base, base);
      }, 0);

    const totalExpense = state.expenses
      .filter(e => selected === "all" ? true : String(e.accountId) === selected)
      .filter(e => (!from && !to) ? true : inDateRange(e.date, from, to))
      .reduce((s, e) => {
        const acc = state.accounts.find(a => a.id === e.accountId);
        return s + convert(e.amount, acc?.currency || base, base);
      }, 0);

    const net = totalIncome - totalExpense;

    out.innerHTML = `
      <div class="dash-grid">
        <div class="dash-card"><div class="label">Баланс</div><div class="value">${fmt(totalAccounts)} ${base}</div></div>
        <div class="dash-card"><div class="label">Доходи</div><div class="value">+ ${fmt(totalIncome)} ${base}</div></div>
        <div class="dash-card"><div class="label">Витрати</div><div class="value">- ${fmt(totalExpense)} ${base}</div></div>
        <div class="dash-card"><div class="label">Чистий потік</div><div class="value">${net >= 0 ? "+" : ""}${fmt(net)} ${base}</div></div>
      </div>
      <div class="dash-chart"><canvas id="dashChartCanvas" height="110"></canvas></div>
    `;

    // income vs expense chart
    const canvas = document.getElementById("dashChartCanvas");
    if (canvas && typeof Chart !== "undefined") {
      const ctx = canvas.getContext("2d");
      if (window.__dashChart) window.__dashChart.destroy();

      window.__dashChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Доходи", "Витрати"],
          datasets: [{ data: [Number(totalIncome.toFixed(2)), Number(totalExpense.toFixed(2))] }]
        },
        options: { responsive: true, plugins: { legend: { position: "bottom" } } }
      });
    }

    // dashboard: expenses by category (if elements exist)
    const catCanvas = document.getElementById("dashExpenseCatChart");
    const topList = document.getElementById("dashTopSubcats");
    if (!catCanvas || !topList || typeof Chart === "undefined") return;

    const rows = state.expenses
      .filter(e => selected === "all" ? true : String(e.accountId) === selected)
      .filter(e => (!from && !to) ? true : inDateRange(e.date, from, to));

    const catTotals = {};
    rows.forEach(e => {
      const c = e.category || "Інше";
      const acc = state.accounts.find(a => a.id === e.accountId);
      const cur = acc?.currency || base;
      const amtBase = convert(e.amount, cur, base);
      catTotals[c] = (catTotals[c] || 0) + Number(amtBase || 0);
    });

    const labels = Object.keys(catTotals).sort((a,b) => (catTotals[b]||0) - (catTotals[a]||0));
    const data = labels.map(l => Number((catTotals[l] || 0).toFixed(2)));

    const ctx2 = catCanvas.getContext("2d");
    if (window.__dashExpCatChart) window.__dashExpCatChart.destroy();

    window.__dashExpCatChart = new Chart(ctx2, {
      type: "doughnut",
      data: { labels, datasets: [{ data }] },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });

    const subTotals = {};
    rows.forEach(e => {
      const sub = e.subcategory || "—";
      const key = `${e.category || "Інше"} / ${sub}`;
      const acc = state.accounts.find(a => a.id === e.accountId);
      const cur = acc?.currency || base;
      const amtBase = convert(e.amount, cur, base);
      subTotals[key] = (subTotals[key] || 0) + Number(amtBase || 0);
    });

    const topKeys = Object.keys(subTotals)
      .sort((a,b) => (subTotals[b]||0) - (subTotals[a]||0))
      .slice(0,5);

    topList.innerHTML = "";
    if (!topKeys.length) {
      const li = document.createElement("li");
      li.style.opacity = "0.75";
      li.textContent = "Немає даних";
      topList.appendChild(li);
      return;
    }

    topKeys.forEach(k => {
      const li = document.createElement("li");
      li.textContent = `${k}: ${fmt(subTotals[k])} ${base}`;
      topList.appendChild(li);
    });
  }

  // ===== Forecast =====
  function avgMonthlyExpenses(lastNMonths = 3) {
    const base = state.settings.baseCurrency;
    const now = new Date();
    const ymList = [];
    for (let i=1; i<=lastNMonths; i++){
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      ymList.push(d.toISOString().slice(0,7));
    }

    const monthTotals = {};
    ymList.forEach(ym => monthTotals[ym] = 0);

    state.expenses.forEach(e => {
      const ym = parseISODateOnly(e.date).slice(0,7);
      if (!monthTotals.hasOwnProperty(ym)) return;
      const acc = state.accounts.find(a => a.id === e.accountId);
      const cur = acc?.currency || base;
      monthTotals[ym] += convert(e.amount, cur, base);
    });

    const sum = Object.values(monthTotals).reduce((s,x)=>s+x,0);
    return sum / Math.max(1, Object.keys(monthTotals).length);
  }

  function forecastCreditsForMonth(ym) {
    const result = [];
    state.credits.forEach(c => {
      const payments = Math.max(1, Number(c.payments || 1));
      const monthly = Number(c.amount || 0) / payments;

      const startYM = (c.start || "").slice(0,7);
      if (!startYM) return;

      const sy = Number(startYM.slice(0,4)), sm = Number(startYM.slice(5,7));
      const ty = Number(ym.slice(0,4)), tm = Number(ym.slice(5,7));
      const diff = (ty - sy) * 12 + (tm - sm);

      if (diff >= 0 && diff < payments) result.push({ name: c.name, monthly });
    });
    return result;
  }

  // expenses page analytics (if elements exist)
  function renderExpensesAnalytics() {
    const canvas = document.getElementById("expensesByCategoryChart");
    const topList = document.getElementById("topSubcatsList");
    const accSel = document.getElementById("analyticsAccount");
    const fromEl = document.getElementById("analyticsFrom");
    const toEl = document.getElementById("analyticsTo");
    if (!canvas || !topList || !accSel || !fromEl || !toEl) return;
    if (typeof Chart === "undefined") return;

    // fill accounts select
    const prev = accSel.value || "all";
    accSel.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "Всі рахунки";
    accSel.appendChild(optAll);
    state.accounts.forEach(a => {
      const opt = document.createElement("option");
      opt.value = String(a.id);
      opt.textContent = a.name;
      accSel.appendChild(opt);
    });
    if ([...accSel.options].some(o => o.value === prev)) accSel.value = prev;

    const selectedAcc = accSel.value || "all";
    const from = fromEl.value || "";
    const to = toEl.value || "";

    const rows = state.expenses
      .filter(e => selectedAcc === "all" ? true : String(e.accountId) === String(selectedAcc))
      .filter(e => (!from && !to) ? true : inDateRange(e.date, from, to));

    const catTotals = {};
    rows.forEach(e => {
      const c = e.category || "Інше";
      catTotals[c] = (catTotals[c] || 0) + Number(e.amount || 0);
    });

    const labels = Object.keys(catTotals).sort((a,b) => (catTotals[b]||0) - (catTotals[a]||0));
    const data = labels.map(l => Number((catTotals[l] || 0).toFixed(2)));

    const ctx = canvas.getContext("2d");
    if (window.__expCatChart) window.__expCatChart.destroy();

    window.__expCatChart = new Chart(ctx, {
      type: "doughnut",
      data: { labels, datasets: [{ data }] },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });

    const subTotals = {};
    rows.forEach(e => {
      const key = `${e.category || "Інше"} / ${(e.subcategory || "—")}`;
      subTotals[key] = (subTotals[key] || 0) + Number(e.amount || 0);
    });

    const topKeys = Object.keys(subTotals)
      .sort((a,b) => (subTotals[b]||0) - (subTotals[a]||0))
      .slice(0,5);

    topList.innerHTML = "";
    if (!topKeys.length) {
      const li = document.createElement("li");
      li.style.opacity = "0.75";
      li.textContent = "Немає даних";
      topList.appendChild(li);
      return;
    }

    topKeys.forEach(k => {
      const li = document.createElement("li");
      li.textContent = `${k}: ${fmt(subTotals[k])}`;
      topList.appendChild(li);
    });
  }

  function renderForecast() {
    const box = document.getElementById("forecastContent");
    if (!box) return;

    const month = document.getElementById("forecastMonth")?.value || new Date().toISOString().slice(0,7);
    const base = state.settings.baseCurrency;

    const credits = forecastCreditsForMonth(month);
    const creditSum = credits.reduce((s,x)=>s+x.monthly,0);

    const avgExp = avgMonthlyExpenses(3);

    box.innerHTML = `
      <div class="card" style="margin-bottom:12px;">
        <strong>Місяць:</strong> ${month}<br>
        <strong>Прогноз витрат (середнє за 3 міс):</strong> ${fmt(avgExp)} ${base}<br>
        <strong>Прогноз платежів по кредитах:</strong> ${fmt(creditSum)} ${base}
      </div>

      <div class="card">
        <strong>Кредити у ${month}</strong>
        <ul style="margin-top:10px;">
          ${credits.length ? credits.map(c=>`<li>${c.name}: ${fmt(c.monthly)} ${base}</li>`).join("") : "<li>Немає платежів</li>"}
        </ul>
      </div>
    `;
  }

  function updateAccountSelects() {
    const incomeAcc = document.getElementById("incomeAccount");
    const expenseAcc = document.getElementById("expenseAccount");
    const capitalAcc = document.getElementById("capitalAccount");

    [incomeAcc, expenseAcc, capitalAcc].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = "";
      state.accounts.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.name;
        sel.appendChild(opt);
      });
    });
  }

  window.addEventListener("expensePresetsChanged", () => {
    renderExpenseCategoryFilters();
    renderExpenses();
    renderExpensesAnalytics();
  });

  // ===== Edit modal openers (called from render lists; modals.js controls actual save) =====
  function openEditIncome(id) {
    const item = state.incomes.find(x => String(x.id) === String(id));
    if (!item) return;

    window.__editContext = { type: "income", id: item.id };

    const amountEl = document.getElementById("incomeAmount");
    const dateEl = document.getElementById("incomeDate");
    const accEl = document.getElementById("incomeAccount");
    const sel = document.getElementById("incomeCategorySelect");
    const manual = document.getElementById("incomeCategory");
    const modal = document.getElementById("modalIncome");

    if (amountEl) amountEl.value = Number(item.amount || 0);
    if (dateEl) dateEl.value = parseISODateOnly(item.date) || new Date().toISOString().slice(0,10);

    updateAccountSelects();
    if (accEl) accEl.value = String(item.accountId || "");

    if (sel && manual) {
      const exists = [...sel.options].some(o => o.value === item.category);
      if (exists) {
        sel.value = item.category;
        manual.classList.add("hidden");
        manual.value = "";
      } else {
        sel.value = "Інше";
        manual.classList.remove("hidden");
        manual.value = item.category || "";
      }
      sel.dispatchEvent(new Event("change"));
    }

    if (modal) { modal.classList.remove("hidden"); modal.classList.add("active"); }
  }

  function openEditExpense(id) {
    const item = state.expenses.find(x => String(x.id) === String(id));
    if (!item) return;

    window.__editContext = { type: "expense", id: item.id };

    const amountEl = document.getElementById("expenseAmount");
    const dateEl = document.getElementById("expenseDate");
    const accEl = document.getElementById("expenseAccount");

    const catSel = document.getElementById("expenseCategorySelect");
    const subSel = document.getElementById("expenseSubcategorySelect");

    const catInp = document.getElementById("expenseCategory");
    const subInp = document.getElementById("expenseSubcategory");

    const modal = document.getElementById("modalExpense");

    if (amountEl) amountEl.value = Number(item.amount || 0);
    if (dateEl) dateEl.value = parseISODateOnly(item.date) || new Date().toISOString().slice(0,10);

    updateAccountSelects();
    if (accEl) accEl.value = String(item.accountId || "");

    if (catSel && subSel && catInp && subInp) {
      const catExists = [...catSel.options].some(o => o.value === item.category);
      if (catExists) {
        catSel.value = item.category;
        catInp.classList.add("hidden");
        catInp.value = "";
      } else {
        catSel.value = "Інше";
        catInp.classList.remove("hidden");
        catInp.value = item.category || "";
      }
      catSel.dispatchEvent(new Event("change"));

      if (item.category === "Цілі") {
        const m = String(item.subcategory || "").match(/id:([^ ]+)/);
        const goalId = m ? m[1] : "";
        if (goalId && [...subSel.options].some(o => o.value === goalId)) subSel.value = goalId;
      } else {
        const subExists = [...subSel.options].some(o => o.value === item.subcategory);
        if (subExists) {
          subSel.value = item.subcategory || "";
          subInp.classList.add("hidden");
          subInp.value = "";
        } else {
          subSel.value = "Інше";
          subInp.classList.remove("hidden");
          subInp.value = item.subcategory || "";
        }
        subSel.dispatchEvent(new Event("change"));
      }
    }

    if (modal) { modal.classList.remove("hidden"); modal.classList.add("active"); }
  }

  // ===== Public API =====
  function renderAll() {
    recalculateBalances();

    renderAccounts();
    renderIncome();
    renderExpenses();
    renderCapital();
    renderGoals();
    renderCredits();
    renderAssets();
    renderTransfers();

    renderDashboard();
    renderForecast();

    renderExpensesAnalytics();

    updateAccountSelects();

    buildAccountFilterOptions(document.getElementById("filterAccountDashboard"), true);
    buildAccountFilterOptions(document.getElementById("filterAccountIncome"), true);
    buildAccountFilterOptions(document.getElementById("filterAccountExpenses"), true);
  }

  window.Finance = {
    state,
    saveAll,
    fmt,
    convert,
    accountName,

    // accounts
    deleteAccount,

    // analytics
    renderExpensesAnalytics,

    // transfers
    deleteTransfer,
    renderTransfers,

    buildAccountFilterOptions,
    renderExpenseCategoryFilters,

    // goals archive
    moveGoalToArchive,
    autoArchiveCompletedGoals,

    // balances
    recalculateBalances,

    // CRUD
    deleteIncome,
    deleteExpense,
    upsertIncome,
    upsertExpense,

    // edit openers
    openEditIncome,
    openEditExpense,

    // renders
    renderAccounts,
    renderIncome,
    renderExpenses,
    renderCapital,
    renderGoals,
    renderCredits,
    renderAssets,
    renderDashboard,
    renderForecast,

    updateAccountSelects,

    renderAll
  };

  // ensure presets include required categories
  getExpensePresets();

  // init baseline + recalc once
  ensureInitialBalances();
  recalculateBalances();
  saveAll();
})();
