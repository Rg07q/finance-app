// income.js
const incomeList = document.getElementById("incomeList");
const addIncomeBtn = document.getElementById("addIncome");

function renderIncome() {
  incomeList.innerHTML = "";
  state.incomes.forEach(inc => {
    const account = state.accounts.find(a => a.id === inc.accountId);
    const li = document.createElement("li");
    li.textContent = `${inc.category}: ${inc.amount} ${account.currency}`;
    incomeList.appendChild(li);
  });
}

addIncomeBtn.addEventListener("click", () => {
  const amount = parseFloat(prompt("Сума доходу:"));
  const category = prompt("Категорія доходу:");
  const accountId = parseInt(prompt("ID рахунку:"));
  if(!isNaN(amount) && category && accountId) {
    state.incomes.push({id: Date.now(), amount, category, accountId, date: new Date().toISOString()});
    const account = state.accounts.find(a => a.id === accountId);
    account.balance += amount;
    renderIncome();
    renderAccounts();
    renderDashboard();
  }
});

renderIncome();
