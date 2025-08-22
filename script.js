const repo = "mykael25/cashflow-tracker";
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

let chart;

// Fetch JSON transactions
async function fetchTransactions() {
  let res = await fetch(apiUrl, {
    headers: { Authorization: `token ${token}` },
  });

  if (res.status === 200) {
    let data = await res.json();
    const content = atob(data.content.replace(/\n/g, ""));
    return { sha: data.sha, transactions: JSON.parse(content) };
  } else if (res.status === 404) {
    return { sha: null, transactions: [] };
  } else if (res.status === 401) {
    alert("Invalid token. Please re-enter.");
    localStorage.removeItem("gh_token");
    location.reload();
  }

  return { sha: null, transactions: [] };
}

// Save JSON back
async function saveTransactions(transactions, sha) {
  const updatedContent = btoa(JSON.stringify(transactions, null, 2));

  return fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: "Update transactions.json",
      content: updatedContent,
      sha: sha,
    }),
  }).then((res) => res.json());
}

// Add new transaction
async function addTransaction(type) {
  const amount = parseFloat(document.getElementById("amount").value);
  const note = document.getElementById("note").value;

  if (!amount || amount <= 0) {
    alert("Please enter a valid amount greater than 0.");
    return;
  }

  const { sha, transactions } = await fetchTransactions();

  const newTransaction = {
    amount,
    type,
    note,
    date: new Date().toISOString(),
  };

  transactions.push(newTransaction);
  await saveTransactions(transactions, sha);

  document.getElementById("transaction-form").reset();
  renderTransactions(transactions);
}

// Render list + summary + chart
function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  let income = 0, expense = 0;

  transactions.forEach((t, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${t.type}: ₱${t.amount} (${t.note || "No note"})</span>
      <button onclick="deleteTransaction(${index})">❌</button>
    `;
    list.appendChild(li);

    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  });

  const balance = income - expense;

  document.getElementById("income").innerText = `₱${income}`;
  document.getElementById("expense").innerText = `₱${expense}`;
  document.getElementById("balance").innerText = `₱${balance}`;

  renderChart(income, expense);
}

// Chart.js
function renderChart(income, expense) {
  const ctx = document.getElementById("cashflowChart").getContext("2d");

  if (chart) chart.destroy(); // prevent infinite growth

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{
        data: [income, expense],
        backgroundColor: ["#4caf50", "#f44336"],
      }],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

// Delete one transaction
async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);
  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

// Event listeners
document.getElementById("add-income").addEventListener("click", () => addTransaction("income"));
document.getElementById("add-expense").addEventListener("click", () => addTransaction("expense"));

// Initial load
(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
