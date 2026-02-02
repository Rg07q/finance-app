// core.js – базовий стан та localStorage
const state = {
  settings: {
    baseCurrency: localStorage.getItem("baseCurrency") || "UAH",
    theme: localStorage.getItem("theme") || "light",
    password: localStorage.getItem("password") || null
  },
  accounts: JSON.parse(localStorage.getItem("accounts")) || [],
  incomes: JSON.parse(localStorage.getItem("incomes")) || [],
  expenses: JSON.parse(localStorage.getItem("expenses")) || [],
  capital: JSON.parse(localStorage.getItem("capital")) || [],
  goals: JSON.parse(localStorage.getItem("goals")) || [],
  currencies: {
    UAH: 1,
    USD: 0.027
  }
};

function saveState() {
  localStorage.setItem("settings", JSON.stringify(state.settings));
  localStorage.setItem("accounts", JSON.stringify(state.accounts));
  localStorage.setItem("incomes", JSON.stringify(state.incomes));
  localStorage.setItem("expenses", JSON.stringify(state.expenses));
  localStorage.setItem("capital", JSON.stringify(state.capital));
  localStorage.setItem("goals", JSON.stringify(state.goals));
}
