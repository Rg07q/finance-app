// accounts.js
const accountsList = document.getElementById("accountsList");
const addAccountBtn = document.getElementById("addAccount");

function renderAccounts() {
  accountsList.innerHTML = "";
  state.accounts.forEach(acc => {
    const li = document.createElement("li");
    li.textContent = `${acc.name} - ${acc.balance} ${acc.currency}`;
    accountsList.appendChild(li);
  });
}

addAccountBtn.addEventListener("click", () => {
  const name = prompt("Назва рахунку:");
  const type = prompt("Тип (cash/card):");
  const currency = prompt("Валюта (UAH/USD/EUR):");
  const balance = parseFloat(prompt("Баланс:"));
  if(name && type && currency && !isNaN(balance)) {
    state.accounts.push({id: Date.now(), name, type, currency, balance});
    renderAccounts();
    renderDashboard();
  }
});

renderAccounts();
