// === STATE ===
const state = {
  settings: { baseCurrency: "UAH", theme: "light" },
  accounts: [],
  incomes: [],
  expenses: [],
  goals: [],
  capital: [],
  currencies: { UAH: 1, USD: 0.027 },
  password: "1234" // приклад паролю
};

// === SELECTORS ===
const sidebar = document.getElementById("sidebar");
const mainContent = document.getElementById("mainContent");
const toggleSidebarBtn = document.getElementById("toggleSidebar");
const toggleThemeBtn = document.getElementById("toggleTheme");

// MODALS
const modal = document.getElementById("modalForm");
const modalTitle = document.getElementById("modalTitle");
const modalBody = document.getElementById("modalBody");
const modalSave = document.getElementById("modalSave");
const modalClose = document.getElementById("modalClose");

const loginModal = document.getElementById("loginModal");
const loginPassword = document.getElementById("loginPassword");
const loginSubmit = document.getElementById("loginSubmit");
const loginCancel = document.getElementById("loginCancel");

// === FUNCTIONS ===
function showPage(pageId) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  const page = document.getElementById(pageId);
  if(page) page.classList.remove("hidden");
  document.querySelectorAll(".menu-item").forEach(m => m.classList.remove("active"));
  document.querySelector(`.menu-item[data-page="${pageId}"]`)?.classList.add("active");
}

function toggleSidebar() {
  sidebar.classList.toggle("collapsed");
}

function toggleTheme() {
  document.body.classList.toggle("light");
  document.body.classList.toggle("dark");
  state.settings.theme = document.body.classList.contains("dark") ? "dark" : "light";
  toggleThemeBtn.textContent = state.settings.theme === "dark" ? "☀️" : "🌙";
}

function openModal(title, fields, onSave) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  const inputs = {};
  fields.forEach(f => {
    const div = document.createElement("div");
    div.style.marginBottom = "8px";
    const label = document.createElement("label");
    label.textContent = f.label;
    const input = document.createElement("input");
    input.type = f.type || "text";
    input.value = f.value || "";
    input.placeholder = f.placeholder || "";
    input.style.width = "100%";
    input.style.padding = "6px 8px";
    input.style.borderRadius = "6px";
    input.style.border = "1px solid #ccc";
    div.appendChild(label);
    div.appendChild(input);
    modalBody.appendChild(div);
    inputs[f.name] = input;
  });

  modal.classList.add("active");

  modalSave.onclick = () => {
    const result = {};
    for(let key in inputs) result[key] = inputs[key].value;
    onSave(result);
    modal.classList.remove("active");
  };

  modalClose.onclick = () => modal.classList.remove("active");
}

// === LOGIN ===
function openLogin() {
  loginPassword.value = "";
  loginModal.classList.add("active");
}

loginSubmit.onclick = () => {
  if(loginPassword.value === state.password) {
    loginModal.classList.remove("active");
    showPage("dashboard");
  } else alert("Невірний пароль!");
};

loginCancel.onclick = () => loginModal.classList.remove("active");

// === EVENT LISTENERS ===
toggleSidebarBtn.onclick = toggleSidebar;
toggleThemeBtn.onclick = toggleTheme;

// MENU NAVIGATION
document.querySelectorAll(".menu-item").forEach(item => {
  item.onclick = () => showPage(item.dataset.page);
});

// === BUTTONS MODAL INTEGRATION ===
function setupAddButtons() {
  document.getElementById("addAccount").onclick = () => openModal("Додати рахунок", [
    {name:"name", label:"Назва рахунку"},
    {name:"type", label:"Тип (готівка/карта)"},
    {name:"currency", label:"Валюта"},
    {name:"balance", label:"Баланс", type:"number"}
  ], data => {
    state.accounts.push({id:Date.now(), ...data});
    console.log("Рахунок додано:", data);
  });

  document.getElementById("addIncome").onclick = () => openModal("Додати дохід", [
    {name:"amount", label:"Сума", type:"number"},
    {name:"category", label:"Категорія"},
    {name:"accountId", label:"Рахунок"}
  ], data => {
    state.incomes.push({id:Date.now(), ...data});
    console.log("Дохід додано:", data);
  });

  document.getElementById("addExpense").onclick = () => openModal("Додати витрату", [
    {name:"amount", label:"Сума", type:"number"},
    {name:"category", label:"Категорія"},
    {name:"subcategory", label:"Підкатегорія"},
    {name:"accountId", label:"Рахунок"}
  ], data => {
    state.expenses.push({id:Date.now(), ...data});
    console.log("Витрата додана:", data);
  });

  document.getElementById("addGoal").onclick = () => openModal("Додати ціль", [
    {name:"name", label:"Назва цілі"},
    {name:"target", label:"Сума цілі", type:"number"},
    {name:"saved", label:"Вже накопичено", type:"number"}
  ], data => {
    state.goals.push({id:Date.now(), ...data});
    console.log("Ціль додана:", data);
  });

  document.getElementById("addCapital")?.onclick = () => openModal("Додати капітал", [
    {name:"name", label:"Назва капіталу"},
    {name:"amount", label:"Сума", type:"number"},
    {name:"type", label:"Тип (готівка/карта)"}
  ], data => {
    state.capital.push({id:Date.now(), ...data});
    console.log("Капітал додано:", data);
  });
}

// === INIT ===
openLogin();
setupAddButtons();
toggleThemeBtn.textContent = state.settings.theme === "dark" ? "☀️" : "🌙";

function openModal(title, fields, onSave) {
  modalTitle.textContent = title;
  modalBody.innerHTML = "";

  const inputs = {};
  fields.forEach(f => {
    const label = document.createElement("label");
    label.textContent = f.label;
    const input = document.createElement(f.type === "select" ? "select" : "input");
    if(f.type !== "select") input.type = f.type || "text";
    if(f.value) input.value = f.value;
    if(f.placeholder) input.placeholder = f.placeholder;
    input.style.marginBottom = "12px";
    modalBody.appendChild(label);
    modalBody.appendChild(input);
    inputs[f.name] = input;

    if(f.type === "select" && f.options) {
      f.options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if(f.value === opt.value) option.selected = true;
        input.appendChild(option);
      });
    }
  });

  modal.classList.add("active");

  modalSave.onclick = () => {
    const result = {};
    for(let key in inputs) result[key] = inputs[key].value;
    onSave(result);
    modal.classList.remove("active");
  };

  modalClose.onclick = () => modal.classList.remove("active");
}
