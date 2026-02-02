// modals.js — Release 1.6+ (FULL)
// Includes: existing modals + Goal Top Up + UX helpers + hooks for future TЗ (transfer/export/import/recalc)

document.addEventListener("DOMContentLoaded", () => {
  if (!window.Finance || !window.Finance.state) return;
  const { state } = window.Finance;

  const $ = (id) => document.getElementById(id);
  const on = (id, evt, fn) => { const el = $(id); if (el) el.addEventListener(evt, fn); };

  function showModal(id){
    const m = $(id);
    if(!m) return;
    m.classList.remove("hidden");
    m.classList.add("active");
    focusFirstInput(m);
  }
  function hideModalById(id){
    const m = $(id);
    if(!m) return;
    m.classList.add("hidden");
    m.classList.remove("active");
  }
  function hideModalNode(m){
    if(!m) return;
    m.classList.add("hidden");
    m.classList.remove("active");
  }
    // ===== TRANSFER (NEW) =====
  function fillTransferSelects() {
    const from = $("transferFrom");
    const to = $("transferTo");
    if (!from || !to) return;

    from.innerHTML = "";
    to.innerHTML = "";

    state.accounts.forEach(a => {
      const opt1 = document.createElement("option");
      opt1.value = String(a.id);
      opt1.textContent = `${a.name} • ${a.currency}`;
      from.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = String(a.id);
      opt2.textContent = `${a.name} • ${a.currency}`;
      to.appendChild(opt2);
    });

    // default: different accounts if possible
    if (state.accounts.length >= 2) {
      from.value = String(state.accounts[0].id);
      to.value = String(state.accounts[1].id);
    }
  }

  on("addTransferBtn", "click", () => {
    fillTransferSelects();

    $("transferAmount").value = "";
    $("transferDate").value = new Date().toISOString().slice(0,10);
    $("transferNote").value = "";

    showModal("modalTransfer");
  });

  on("saveTransfer", "click", () => {
    const fromAccountId = Number($("transferFrom")?.value || 0);
    const toAccountId = Number($("transferTo")?.value || 0);
    const amount = Number($("transferAmount")?.value || 0);
    const date = $("transferDate")?.value || new Date().toISOString().slice(0,10);
    const note = ($("transferNote")?.value || "").trim();

    if (!fromAccountId || !toAccountId) return;
    if (fromAccountId === toAccountId) return alert("Обери різні рахунки для переказу.");
    if (amount <= 0) return;

    const fromAcc = state.accounts.find(a => a.id === fromAccountId);
    const toAcc = state.accounts.find(a => a.id === toAccountId);
    if (!fromAcc || !toAcc) return;

    // currency guard (поки без конвертації)
    if (fromAcc.currency !== toAcc.currency) {
      return alert("Переказ між різними валютами поки не підтримується. Обери рахунки з однаковою валютою.");
    }

    state.transfers = Array.isArray(state.transfers) ? state.transfers : [];
    state.transfers.push({
      id: Date.now(),
      fromAccountId,
      toAccountId,
      amount,
      date: date + "T00:00:00.000Z",
      note
    });

    window.Finance.recalculateBalances?.();
    window.Finance.saveAll();
    window.Finance.renderAll();

    hideModalById("modalTransfer");
  });


  // ===== Global modal close handlers =====
  document.querySelectorAll(".closeModal").forEach(btn=>{
    btn.addEventListener("click", e => hideModalNode(e.target.closest(".modal")));
  });

  document.querySelectorAll(".modal").forEach(m=>{
    m.addEventListener("click", e=>{
      if(e.target === m) hideModalNode(m);
    });
  });

  document.addEventListener("keydown", e=>{
    if(e.key === "Escape") document.querySelectorAll(".modal.active").forEach(hideModalNode);
  });

  // ===== UX: focus + Enter = Save (optional) =====
  function focusFirstInput(modalEl){
    // focus first input[type=number] or first input
    const preferred =
      modalEl.querySelector('input[type="number"]:not([disabled])') ||
      modalEl.querySelector('input:not([type="hidden"]):not([disabled])') ||
      modalEl.querySelector('select:not([disabled])');

    preferred?.focus?.();
  }

  // Press Enter inside active modal -> click primary button if exists
  document.addEventListener("keydown", (e) => {
    if(e.key !== "Enter") return;

    const activeModal = document.querySelector(".modal.active");
    if(!activeModal) return;

    // don't hijack if focus is on textarea
    const tag = (document.activeElement?.tagName || "").toLowerCase();
    if(tag === "textarea") return;

    // if focused element is a button, let it work normally
    if(tag === "button") return;

    const primary = activeModal.querySelector(".btn-primary, #saveExpense, #saveIncome, #saveGoal, #saveAccount, #saveCapital, #saveCredit, #saveAsset, #saveGoalTopUp");
    if(primary) {
      e.preventDefault();
      primary.click();
    }
  });

  // ===== Auth respects lockEnabled =====
  const authModal = $("modalAuth");
  const authTitle = $("authTitle");
  const authInput = $("authPassword");
  const authBtn = $("authSubmit");
  const authError = $("authError");
  const app = document.querySelector(".app");

  function lockUI(){ if(!authModal) return; showModal("modalAuth"); app?.classList.add("blur"); }
  function unlockUI(){ hideModalById("modalAuth"); app?.classList.remove("blur"); }
  function setAuthError(t){ if(!authError) return; authError.textContent=t; authError.classList.remove("hidden"); }
  function clearAuthError(){ if(!authError) return; authError.textContent=""; authError.classList.add("hidden"); }

  function authFlow(){
    const saved = localStorage.getItem("financePassword");
    if(!state.settings.lockEnabled){ unlockUI(); return; }
    if(!authModal || !authInput || !authBtn) return;

    authInput.value=""; clearAuthError();

    if(!saved){
      if(authTitle) authTitle.textContent="🔐 Створіть пароль";
      lockUI();
      authBtn.onclick=()=>{
        const val = authInput.value.trim();
        if(val.length<4) return setAuthError("Пароль мінімум 4 символи");
        localStorage.setItem("financePassword", val);
        unlockUI();
      };
    } else {
      if(authTitle) authTitle.textContent="🔐 Введіть пароль";
      lockUI();
      authBtn.onclick=()=>{
        if(authInput.value===saved) unlockUI();
        else setAuthError("Невірний пароль");
      };
    }
  }
  window.Auth = { authFlow };

  // ===== dropdowns =====
  function setupIncomeDropdowns(){
    const sel=$("incomeCategorySelect");
    const inp=$("incomeCategory");
    if(!sel || !inp) return;
    sel.onchange=()=>{
      if(sel.value==="Інше") inp.classList.remove("hidden");
      else { inp.classList.add("hidden"); inp.value=""; }
    };
    sel.onchange();
  }

  function getExpensePresets(){
    try{
      const p = JSON.parse(localStorage.getItem("expensePresets") || "null");
      if(p && Object.keys(p).length) {
        // ensure "Цілі" exists
        if(!p["Цілі"]) {
          p["Цілі"] = ["Внесок у ціль"];
          localStorage.setItem("expensePresets", JSON.stringify(p));
          window.dispatchEvent(new Event("expensePresetsChanged"));
        }
        return p;
      }
    }catch{}

    const d = {
      "Їжа": ["Продукти","Кафе/Ресторани","Доставка","Інше"],
      "Авто": ["Пальне","Ремонт","Страхування","Інше"],
      "Дім": ["Комуналка","Оренда","Ремонт","Інше"],
      "Інше": ["Інше"],
      "Цілі": ["Внесок у ціль"]
    };
    localStorage.setItem("expensePresets", JSON.stringify(d));
    return d;
  }

  function setupExpenseDropdowns(){
    const presets=getExpensePresets();
    const catSel=$("expenseCategorySelect");
    const subSel=$("expenseSubcategorySelect");
    const catInp=$("expenseCategory");
    const subInp=$("expenseSubcategory");
    if(!catSel || !subSel || !catInp || !subInp) return;

    catSel.innerHTML="";
    Object.keys(presets).forEach(c=>{
      const opt=document.createElement("option");
      opt.value=c; opt.textContent=c;
      catSel.appendChild(opt);
    });

    function rebuildSubForGoals(){
      subSel.innerHTML="";
      const goals = Array.isArray(state.goals) ? state.goals : [];
      if(!goals.length){
        const opt=document.createElement("option");
        opt.value="";
        opt.textContent="Немає активних цілей";
        subSel.appendChild(opt);
        return;
      }
      goals.forEach(g=>{
        const opt=document.createElement("option");
        opt.value=String(g.id);     // IMPORTANT: goalId
        opt.textContent=g.name;     // label
        subSel.appendChild(opt);
      });
    }

    function rebuild(){
      const cat=catSel.value;

      // manual category
      if(cat==="Інше") catInp.classList.remove("hidden");
      else { catInp.classList.add("hidden"); catInp.value=""; }

      // goals mode
      if(cat==="Цілі"){
        rebuildSubForGoals();
        subInp.classList.add("hidden");
        subInp.value="";
        return;
      }

      // normal mode
      const subs=presets[cat] || ["Інше"];
      subSel.innerHTML="";
      subs.forEach(s=>{
        const opt=document.createElement("option");
        opt.value=s; opt.textContent=s;
        subSel.appendChild(opt);
      });

      if(subSel.value==="Інше") subInp.classList.remove("hidden");
      else { subInp.classList.add("hidden"); subInp.value=""; }
    }

    catSel.onchange=rebuild;
    subSel.onchange=()=>{
      if(catSel.value==="Цілі"){
        subInp.classList.add("hidden");
        subInp.value="";
        return;
      }
      if(subSel.value==="Інше") subInp.classList.remove("hidden");
      else { subInp.classList.add("hidden"); subInp.value=""; }
    };

    catSel.value=Object.keys(presets)[0] || "Інше";
    rebuild();
  }

  window.addEventListener("expensePresetsChanged", ()=>{
    setupExpenseDropdowns();
    window.Finance.renderExpenseCategoryFilters?.();
    window.Finance.renderExpenses?.();
  });

  // ===== open modals =====
  on("addAccountBtn","click", ()=> showModal("modalAccount"));
  on("addIncomeBtn","click", ()=>{
    window.Finance.updateAccountSelects();
    setupIncomeDropdowns();
    $("incomeAmount").value="";
    $("incomeDate").value = new Date().toISOString().slice(0,10);
    showModal("modalIncome");
  });

  on("addExpenseBtn","click", ()=>{
    window.Finance.updateAccountSelects();
    setupExpenseDropdowns();
    $("expenseAmount").value="";
    $("expenseDate").value = new Date().toISOString().slice(0,10);
    showModal("modalExpense");
  });

  on("addCapitalBtn","click", ()=>{
    window.Finance.updateAccountSelects();
    showModal("modalCapital");
  });

  on("addGoalBtn","click", ()=> showModal("modalGoal"));

  // credits/assets modals
  on("addCreditBtn","click", ()=>{
    $("creditName").value="";
    $("creditAmount").value="";
    $("creditPayments").value="";
    $("creditStart").value = new Date().toISOString().slice(0,10);
    showModal("modalCredit");
  });

  on("addAssetBtn","click", ()=>{
    $("assetName").value="";
    $("assetAmount").value="";
    showModal("modalAsset");
  });

  // forecast month change
  $("forecastMonth")?.addEventListener("change", ()=> window.Finance.renderForecast());

  // dashboard/inc/exp date filters
  ["dashFrom","dashTo"].forEach(id => $(id)?.addEventListener("change", ()=> window.Finance.renderDashboard()));
  ["incFrom","incTo"].forEach(id => $(id)?.addEventListener("change", ()=> window.Finance.renderIncome()));
  ["expFrom","expTo"].forEach(id => $(id)?.addEventListener("change", ()=> window.Finance.renderExpenses()));

  // ===== save handlers =====
  on("saveAccount","click", ()=>{
    const name=($("accountName").value||"").trim();
    const type=$("accountType").value || "cash";
    const currency=$("accountCurrency").value || "UAH";
    const balance=Number($("accountBalance").value||0);
    if(!name) return;

    state.accounts.push({id:Date.now(),name,type,currency,balance});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalAccount");
  });

  on("saveIncome","click", ()=>{
    const amount=Number($("incomeAmount").value||0);
    const date=$("incomeDate").value || new Date().toISOString().slice(0,10);
    const accountId=Number($("incomeAccount").value||0);
    const sel=$("incomeCategorySelect");
    const manual=($("incomeCategory").value||"").trim();
    const category=(sel && sel.value!=="Інше") ? sel.value : manual;
    if(!category || !accountId || amount<=0) return;

    const acc=state.accounts.find(a=>a.id===accountId);
    if(acc) acc.balance += amount;

    state.incomes.push({id:Date.now(),amount,category,accountId,date: date + "T00:00:00.000Z"});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalIncome");
  });

  on("saveExpense","click", ()=>{
    const amount=Number($("expenseAmount").value||0);
    const date=$("expenseDate").value || new Date().toISOString().slice(0,10);
    const accountId=Number($("expenseAccount").value||0);

    const catSel=$("expenseCategorySelect");
    const subSel=$("expenseSubcategorySelect");
    const manualCat=($("expenseCategory").value||"").trim();
    const manualSub=($("expenseSubcategory").value||"").trim();
    const category=(catSel && catSel.value!=="Інше") ? catSel.value : manualCat;

    if(!category || !accountId || amount<=0) return;

    const acc=state.accounts.find(a=>a.id===accountId);
    if(acc) acc.balance -= amount;

    let subcategory = "";

    // ✅ category "Цілі" => choose active goal and top-up goal.saved
    if(category === "Цілі") {
      const goalId = (subSel?.value || "").trim();
      if(!goalId) return;

      const goal = state.goals.find(g => String(g.id) === String(goalId));
      if(!goal) return;

      goal.saved = Number(goal.saved || 0) + amount;
      subcategory = `id:${goalId} • ${goal.name}`;

      // auto archive if implemented in finance.js
      window.Finance.autoArchiveCompletedGoals?.();
    } else {
      const subSelVal = subSel ? subSel.value : "";
      subcategory = (subSel && subSelVal!=="Інше") ? subSelVal : manualSub;
    }

    state.expenses.push({id:Date.now(),amount,category,subcategory,accountId,date: date + "T00:00:00.000Z"});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalExpense");
  });

  on("saveCapital","click", ()=>{
    const name=($("capitalName").value||"Капітал").trim();
    const amount=Number($("capitalAmount").value||0);
    const accountId=Number($("capitalAccount").value||0);
    if(!accountId) return;
    state.capital.push({id:Date.now(),name,amount,accountId});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalCapital");
  });

  on("saveGoal","click", ()=>{
    const name=($("goalName").value||"").trim();
    const target=Number($("goalTarget").value||0);
    const saved=Number($("goalSaved").value||0);
    if(!name || target<=0) return;
    state.goals.push({id:Date.now(),name,target,saved});

    // auto archive if implemented in finance.js
    window.Finance.autoArchiveCompletedGoals?.();

    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalGoal");
  });

  on("saveCredit","click", ()=>{
    const name=($("creditName").value||"").trim();
    const amount=Number($("creditAmount").value||0);
    const payments=Number($("creditPayments").value||0);
    const start=$("creditStart").value || new Date().toISOString().slice(0,10);
    if(!name || amount<=0 || payments<=0) return;

    state.credits.push({id:Date.now(),name,amount,payments,start});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalCredit");
  });

  on("saveAsset","click", ()=>{
    const type=$("assetType").value || "Інше";
    const name=($("assetName").value||"").trim();
    const amount=Number($("assetAmount").value||0);
    const currency=$("assetCurrency").value || "UAH";
    const trend=$("assetTrend").value || "Стабільний";
    if(!name || amount<=0) return;

    state.assets.push({id:Date.now(),type,name,amount,currency,trend});
    window.Finance.saveAll(); window.Finance.renderAll();
    hideModalById("modalAsset");
  });

  // ===== account adjust (+/-) =====
  (function accountAdjust(){
    const list = $("accountsList");
    const title = $("accAdjTitle");
    const sub = $("accAdjSubtitle");
    const amountInp = $("accAdjAmount");
    const saveBtn = $("accAdjSave");
    if(!list || !saveBtn || !amountInp) return;

    let currentId=null;
    let mode="plus";

    list.addEventListener("click",(e)=>{
      const btn=e.target.closest("[data-act]");
      if(!btn) return;
      mode=btn.getAttribute("data-act");
      currentId=Number(btn.getAttribute("data-id")||0);
      const acc=state.accounts.find(a=>a.id===currentId);
      if(!acc) return;

      if(title) title.textContent = (mode==="plus") ? "➕ Поповнити рахунок" : "➖ Списати з рахунку";
      if(sub) sub.textContent = `${acc.name} • ${acc.currency}`;
      amountInp.value="";
      showModal("modalAccountAdjust");
    });

    saveBtn.addEventListener("click",()=>{
      const amount=Number(amountInp.value||0);
      if(!currentId || amount<=0) return;
      const acc=state.accounts.find(a=>a.id===currentId);
      if(!acc) return;

      if(mode==="plus") acc.balance += amount;
      else acc.balance -= amount;

      window.Finance.saveAll(); window.Finance.renderAll();
      hideModalById("modalAccountAdjust");
    });
  })();

  // ===== NEW: Goal Top Up modal (requires HTML: #topUpGoalBtn + #modalGoalTopUp) =====
  function fillAccounts(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    state.accounts.forEach(a => {
      const opt = document.createElement("option");
      opt.value = String(a.id);
      opt.textContent = `${a.name} • ${a.currency}`;
      selectEl.appendChild(opt);
    });
  }

  function fillActiveGoals(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";

    const goals = Array.isArray(state.goals) ? state.goals : [];
    if (!goals.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Немає активних цілей";
      selectEl.appendChild(opt);
      return;
    }

    goals.forEach(g => {
      const saved = Number(g.saved || 0);
      const target = Number(g.target || 0);
      const opt = document.createElement("option");
      opt.value = String(g.id);
      opt.textContent = `${g.name} (${window.Finance.fmt(saved)} / ${window.Finance.fmt(target)})`;
      selectEl.appendChild(opt);
    });
  }

  on("topUpGoalBtn", "click", () => {
    fillActiveGoals($("topUpGoalSelect"));
    fillAccounts($("topUpGoalAccount"));

    const amountEl = $("topUpGoalAmount");
    if (amountEl) amountEl.value = "";

    const dateEl = $("topUpGoalDate");
    if (dateEl) dateEl.value = new Date().toISOString().slice(0,10);

    showModal("modalGoalTopUp");
  });

   on("saveGoalTopUp", "click", () => {
    const goalId = ($("topUpGoalSelect")?.value || "").trim();
    const accountId = Number($("topUpGoalAccount")?.value || 0);
    const amount = Number($("topUpGoalAmount")?.value || 0);
    const date = $("topUpGoalDate")?.value || new Date().toISOString().slice(0,10);

    if (!goalId) return;
    if (!accountId || amount <= 0) return;

    const goal = state.goals.find(g => String(g.id) === String(goalId));
    if (!goal) return;

    // 1) записуємо витрату категорії "Цілі"
    const subcategory = `id:${goalId} • ${goal.name}`;
    state.expenses.push({
      id: Date.now(),
      amount,
      category: "Цілі",
      subcategory,
      accountId,
      date: date + "T00:00:00.000Z"
    });

    // 2) НЕ міняємо acc.balance руками
    // 3) перераховуємо все з історії
    window.Finance.recalculateBalances?.();
    window.Finance.autoArchiveCompletedGoals?.();

    window.Finance.saveAll();
    window.Finance.renderAll();
    hideModalById("modalGoalTopUp");
  });


  // ===== Hooks for future TЗ (won't break if HTML missing) =====

  // (TЗ #3) Recalculate balances button (if exists)
  on("recalcBalancesBtn", "click", () => {
    if (typeof window.Finance.recalculateBalances === "function") {
      window.Finance.recalculateBalances();
      window.Finance.saveAll();
      window.Finance.renderAll();
    } else {
      alert("recalculateBalances() ще не додано у finance.js (це буде на кроці 3 ТЗ).");
    }
  });

  // (TЗ #7) Export/Import buttons (if you add them in Settings)
  on("exportDataBtn", "click", () => {
    const dump = {
      accounts: state.accounts,
      incomes: state.incomes,
      expenses: state.expenses,
      capital: state.capital,
      goals: state.goals,
      goalsArchive: state.goalsArchive || [],
      credits: state.credits,
      assets: state.assets,
      expensePresets: (() => { try { return JSON.parse(localStorage.getItem("expensePresets") || "null"); } catch { return null; } })(),
      settings: state.settings,
      meta: { app: "Finance App", version: "1.7-draft", exportedAt: new Date().toISOString() }
    };

    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `finance_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  });

  // expects <input type="file" id="importDataInput" accept="application/json">
  on("importDataInput", "change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || !data.meta || !data.accounts || !data.expenses) {
        alert("Файл не схожий на бекап Finance App.");
        e.target.value = "";
        return;
      }

      // restore core keys
      localStorage.setItem("accounts", JSON.stringify(data.accounts || []));
      localStorage.setItem("incomes", JSON.stringify(data.incomes || []));
      localStorage.setItem("expenses", JSON.stringify(data.expenses || []));
      localStorage.setItem("capital", JSON.stringify(data.capital || []));
      localStorage.setItem("goals", JSON.stringify(data.goals || []));
      localStorage.setItem("goalsArchive", JSON.stringify(data.goalsArchive || []));
      localStorage.setItem("credits", JSON.stringify(data.credits || []));
      localStorage.setItem("assets", JSON.stringify(data.assets || []));

      if (data.expensePresets) localStorage.setItem("expensePresets", JSON.stringify(data.expensePresets));

      if (data.settings) {
        // keep settings consistent with current app
        localStorage.setItem("theme", data.settings.theme || "light");
        localStorage.setItem("baseCurrency", data.settings.baseCurrency || "UAH");
        localStorage.setItem("lockEnabled", String(!!data.settings.lockEnabled));
        localStorage.setItem("expenseCategoryFilter", data.settings.expenseCategoryFilter || "all");
      }

      alert("Імпорт виконано ✅ Сторінка перезавантажиться.");
      location.reload();
    } catch {
      alert("Не вдалося імпортувати: файл пошкоджений або не JSON.");
    } finally {
      e.target.value = "";
    }
  });

  // init
  window.Finance.renderAll();
  authFlow();
});
