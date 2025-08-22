const repo = "mykael25/cashflow-tracker";
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

let currentFilter = "all";
let chartInstance = null;

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

async function saveTransactions(transactions, sha) {
  const updatedContent = btoa(JSON.stringify(transactions, null, 2));

  let res = await fetch(apiUrl, {
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
  });

  return res.json();
}

async function addTransaction(newTransaction) {
  if (newTransaction.amount <= 0) return alert("Amount must be greater than zero!");

  const { sha, transactions } = await fetchTransactions();
  transactions.push(newTransaction);

  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);
  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function clearAllTransactions() {
  if (!confirm("Delete all records?")) return;
  const { sha } = await fetchTransactions();
  await saveTransactions([], sha);
  renderTransactions([]);
}

function groupTransactions(transactions, filter) {
  const groups = {};

  transactions.forEach((t) => {
    const date = new Date(t.date);

    let key = "all";
    if (filter === "monthly") {
      key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    } else if (filter === "15days") {
      const half = date.getDate() <= 15 ? "1st Half" : "2nd Half";
      key = `${date.getFullYear()}-${date.getMonth() + 1} ${half}`;
    }

    if (!groups[key]) groups[key] = { income: 0, expense: 0 };
    groups[key][t.type] += parseFloat(t.amount);
  });

  return groups;
}

function renderChart(transactions) {
  const ctx = document.getElementById("chart").getContext("2d");
  const groups = groupTransactions(transactions, currentFilter);

  const labels = Object.keys(groups);
  const incomeData = labels.map((k) => groups[k].income);
  const expenseData = labels.map((k) => groups[k].expense);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Income", data: incomeData, backgroundColor: "green" },
        { label: "Expense", data: expenseData, backgroundColor: "red" },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  const summary = document.getElementById("summary");

  list.innerHTML = "";

  let income = 0, expense = 0;

  transactions.forEach((t, index) => {
    const li = document.createElement("li");
    li.className = t.type;
    li.innerHTML = `
      <span>${t.date.split("T")[0]} | ${t.type.toUpperCase()}: ₱${t.amount} - ${t.note}</span>
      <button onclick="deleteTransaction(${index})">❌</button>
    `;
    list.appendChild(li);

    if (t.type === "income") income += parseFloat(t.amount);
    else expense += parseFloat(t.amount);
  });

  let balance = income - expense;

  summary.innerHTML = `
    <p><strong>Total Income:</strong> ₱${income.toFixed(2)}</p>
    <p><strong>Total Expense:</strong> ₱${expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> ₱${balance.toFixed(2)}</p>
  `;

  renderChart(transactions);
}

function setFilter(filter) {
  currentFilter = filter;
  fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
}

function toggleCompact() {
  document.body.classList.toggle("compact");
}

document.getElementById("transaction-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = document.getElementById("amount").value;
  const type = document.querySelector('input[name="type"]:checked').value;
  const note = document.getElementById("note").value;

  await addTransaction({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  document.getElementById("transaction-form").reset();
});

document.getElementById("clear-all").addEventListener("click", clearAllTransactions);

(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
