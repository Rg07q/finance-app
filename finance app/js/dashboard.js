// dashboard.js – графіки Chart.js
document.addEventListener("DOMContentLoaded", () => {
  const ctx = document.getElementById("dashboardChart").getContext("2d");

  function getDashboardData() {
    const incomeSum = state.incomes.reduce((a,b)=>a+b.amount,0);
    const expenseSum = state.expenses.reduce((a,b)=>a+b.amount,0);
    return {
      labels: ["Доходи", "Витрати"],
      datasets: [{
        label: "Баланс",
        data: [incomeSum, expenseSum],
        backgroundColor: ["#4CAF50", "#F44336"]
      }]
    };
  }

  new Chart(ctx, {
    type: "doughnut",
    data: getDashboardData(),
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
});
