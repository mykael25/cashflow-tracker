const repo = "mykael25/cashflow-tracker"; 
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

let currentFilter = "all";
let compactMode = false;
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
  if (parseFloat(newTransaction.amount) <= 0) {
    alert("Amount must be greater than zero.");
    return;
  }

  const { sha, transactions } = await fetchTransactions();
  transactions.push(newTransaction);
  const result = await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);
  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function deleteAllTransactions() {
  if (!confirm("Are you sure you want to delete all records?")) return;
  const { sha } = await fetchTransactions();
  await saveTransactions([], sha);
  renderTransactions([]);
}

function applyFilter(transactions) {
  if (currentFilter === "monthly") {
    const grouped = {};
    transactions.forEach(t => {
      const month = new Date(t.date).toLocaleString("default", { month: "short", year: "numeric" });
      if (!grouped[month]) grouped[month] = [];
      grouped[month].push(t);
    });
    return grouped;
  } else if (currentFilter === "15days") {
    const grouped = {};
    transactions.forEach(t => {
      const d = new Date(t.date);
      const half = d.getDate() <= 15 ? "1st Half" : "2nd Half";
      const key = `${half} - ${d.toLocaleString("default", { month: "short", year: "numeric" })}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    });
    return grouped;
  }
  return { All: transactions };
}

function renderSummary(transactions) {
  let income = 0, expense = 0;
  transactions.forEach(t => {
    if (t.type === "income") income += parseFloat(t.amount);
    else expense += parseFloat(t.amount);
  });
  let balance = income - expense;

  document.getElementById("summary").innerHTML = `
    <p><strong>Total Income:</strong> ₱${income.toFixed(2)}</p>
    <p><strong>Total Expense:</strong> ₱${expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> ₱${balance.toFixed(2)}</p>
  `;
}

function renderChart(transactions) {
  const ctx = document.getElementById("cashflow-chart").getContext("2d");
  if (chartInstance) chartInstance.destroy(); // prevent infinite growth

  const grouped = applyFilter(transactions);
  const labels = Object.keys(grouped);
  const incomeData = labels.map(label =>
    grouped[label].filter(t => t.type === "income").reduce((a,b)=>a+parseFloat(b.amount),0)
  );
  const expenseData = labels.map(label =>
    grouped[label].filter(t => t.type === "expense").reduce((a,b)=>a+parseFloat(b.amount),0)
  );

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Income", data: incomeData, backgroundColor: "green" },
        { label: "Expense", data: expenseData, backgroundColor: "red" }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  renderSummary(transactions);
  renderChart(transactions);

  const grouped = applyFilter(transactions);

  Object.keys(grouped).forEach(group => {
    const header = document.createElement("h3");
    header.textContent = group;
    list.appendChild(header);

    grouped[group].forEach((t, index) => {
      const li = document.createElement("li");
      li.className = compactMode ? "compact" : "";
      li.innerHTML = `
        ${t.date.split("T")[0]} | ${t.type.toUpperCase()}: ₱${t.amount} - ${t.note}
        <button onclick="deleteTransaction(${transactions.indexOf(t)})">X</button>
      `;
      list.appendChild(li);
    });
  });
}

document.getElementById("transaction-form").addEventListener("submit", async e => {
  e.preventDefault();
  const amount = document.getElementById("amount").value;
  const type = document.querySelector("input[name='type']:checked").value;
  const note = document.getElementById("note").value;
  await addTransaction({ amount, type, note, date: new Date().toISOString() });
  document.getElementById("transaction-form").reset();
});

document.getElementById("delete-all").addEventListener("click", deleteAllTransactions);
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.dataset.filter;
    fetchTransactions().then(d => renderTransactions(d.transactions));
  });
});

document.getElementById("compact-toggle").addEventListener("click", () => {
  compactMode = !compactMode;
  fetchTransactions().then(d => renderTransactions(d.transactions));
});

(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
