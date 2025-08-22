const repo = "mykael25/cashflow-tracker";
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
let currentFilter = "all";
let monthlyHalf = null; // "first" or "second"
let compactView = false;
let chartInstance = null;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

async function fetchTransactions() {
  let res = await fetch(apiUrl, { headers: { Authorization: `token ${token}` } });

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
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Update transactions.json", content: updatedContent, sha }),
  });
  return res.json();
}

async function addTransaction(type) {
  const amount = parseFloat(document.getElementById("amount").value);
  const note = document.getElementById("note").value;

  if (!amount || amount <= 0) return alert("Please enter a valid amount");

  const { sha, transactions } = await fetchTransactions();
  transactions.push({ amount, type, note, date: new Date().toISOString() });
  await saveTransactions(transactions, sha);

  document.getElementById("transaction-form").reset();
  renderTransactions(transactions);
}

async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);
  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function clearAllTransactions() {
  const { sha } = await fetchTransactions();
  await saveTransactions([], sha);
  renderTransactions([]);
}

function filterTransactions(transactions) {
  const today = new Date();

  if (currentFilter === "15days") {
    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();

    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;

      if (day <= 15) {
        return d.getDate() >= 1 && d.getDate() <= 15;
      } else {
        return d.getDate() >= 16;
      }
    });
  } else if (currentFilter === "monthly") {
    const month = today.getMonth();
    const year = today.getFullYear();

    return transactions.filter((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;

      if (monthlyHalf === "first") {
        return d.getDate() >= 1 && d.getDate() <= 15;
      } else if (monthlyHalf === "second") {
        return d.getDate() >= 16;
      }
      return true; // if no half selected, return all of current month
    });
  }

  return transactions;
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  const summary = document.getElementById("summary");

  list.innerHTML = "";
  summary.innerHTML = "";

  const filtered = filterTransactions(transactions);

  let income = 0, expense = 0;
  filtered.forEach((t, idx) => {
    const li = document.createElement("li");
    li.className = "flex justify-between items-center border-b py-1";

    li.innerHTML = `
      <span class="${compactView ? "text-sm" : ""}">
        ${t.date.split("T")[0]} | ${t.type === "income" ? "➕" : "➖"} ₱${t.amount} ${compactView ? "" : "- " + t.note}
      </span>
      <button class="text-red-500 text-sm" onclick="deleteTransaction(${idx})">🗑️</button>
    `;
    list.appendChild(li);

    if (t.type === "income") income += parseFloat(t.amount);
    else expense += parseFloat(t.amount);
  });

  let balance = income - expense;

  summary.innerHTML = `
    <p><strong>Income:</strong> ₱${income.toFixed(2)}</p>
    <p><strong>Expense:</strong> ₱${expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> ₱${balance.toFixed(2)}</p>
  `;

  const ctx = document.getElementById("summaryChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{ data: [income, expense], backgroundColor: ["#10B981", "#EF4444"] }],
    },
  });
}

// --- Event Listeners ---
// Income & Expense act as Add buttons
document.getElementById("incomeBtn").addEventListener("click", () => addTransaction("income"));
document.getElementById("expenseBtn").addEventListener("click", () => addTransaction("expense"));

// Filters
document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    monthlyHalf = null;

    // Show/hide monthly-half buttons
    document.getElementById("monthly-half").classList.toggle("hidden", currentFilter !== "monthly");

    fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
  });
});

// Monthly half selector
document.querySelectorAll(".monthly-half-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    monthlyHalf = btn.dataset.half;
    fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
  });
});

// Toggle view
document.getElementById("toggleView").addEventListener("click", () => {
  compactView = !compactView;
  fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
});

// Clear all
document.getElementById("clearAll").addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all records?")) clearAllTransactions();
});

// Init
(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
