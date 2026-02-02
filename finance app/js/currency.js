const baseCurrencySelect = document.getElementById("baseCurrency");

baseCurrencySelect.addEventListener("change", (e) => {
  state.settings.baseCurrency = e.target.value;
  updateAccountsDisplay();
});

function convertCurrency(amount, from, to) {
  const rateFrom = state.currencies[from];
  const rateTo = state.currencies[to];
  return (amount / rateFrom) * rateTo;
}

function updateAccountsDisplay() {
  const list = document.getElementById("accountsList");
  list.innerHTML = "";
  state.accounts.forEach(acc => {
    const converted = convertCurrency(acc.balance, acc.currency, state.settings.baseCurrency);
    const li = document.createElement("li");
    li.textContent = `${acc.name} (${acc.currency}): ${converted.toFixed(2)} ${state.settings.baseCurrency}`;
    list.appendChild(li);
  });
}

updateAccountsDisplay();
