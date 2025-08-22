const repo = "mykael25/cashflow-tracker";
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;
let currentFilter = "all";
let monthlyHalf = null;
let compactView = false;
let chartInstance = null;
let dateRange = { from: null, to: null };
let searchQuery = "";

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
  const dateInput = document.getElementById("dateInput").value;

  if (!amount || amount <= 0) return alert("Please enter a valid amount");

  const date = dateInput ? new Date(dateInput).toISOString() : new Date().toISOString();

  const { sha, transactions } = await fetchTransactions();
  transactions.push({ amount, type, note, date });
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
  let filtered = [...transactions];

  if (currentFilter === "15days") {
    const day = today.getDate();
    const month = today.getMonth();
    const year = today.getFullYear();

    filtered = filtered.filter((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      return day <= 15 ? d.getDate() <= 15 : d.getDate() >= 16;
    });
  } else if (currentFilter === "monthly") {
    const month = today.getMonth();
    const year = today.getFullYear();

    filtered = filtered.filter((t) => {
      const d = new Date(t.date);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      if (monthlyHalf === "first") return d.getDate() <= 15;
      if (monthlyHalf === "second") return d.getDate() >= 16;
      return true;
    });
  }
  // Date range filter
  if (dateRange.from && dateRange.to) {
    const from = new Date(dateRange.from);
    const to = new Date(dateRange.to);
    filtered = filtered.filter((t) => {
      const d = new Date(t.date);
      return d >= from && d <= to;
    });
  }

  if (searchQuery) {
    filtered = filtered.filter((t) => {
      return (
        (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase())) ||
        t.amount.toString().includes(searchQuery)
      );
    });
  }

  return filtered;
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  const summary = document.getElementById("summary");
  const countEl = document.getElementById("transactionCount");

  list.innerHTML = "";
  summary.innerHTML = "";

  let filtered = filterTransactions(transactions);

  // Order by date (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

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

  countEl.textContent = `${filtered.length} transaction(s) shown`;

  const ctx = document.getElementById("summaryChart").getContext("2d");
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: "doughnut",
    data: { labels: ["Income", "Expense"], datasets: [{ data: [income, expense], backgroundColor: ["#10B981", "#EF4444"] }] },
  });
}
// --- Export Functions ---
async function exportData(mode) {
  const { transactions } = await fetchTransactions();
  let data = [];

  if (mode === "all") {
    data = transactions;
  } else if (mode === "range") {
    data = filterTransactions(transactions); // will respect dateRange
  } else if (mode === "filter") {
    data = filterTransactions(transactions); // currentFilter applied
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  saveAs(blob, `cashflow-${mode}.json`);
}

async function exportScreenshot() {
  const element = document.querySelector(".max-w-md");
  html2canvas(element).then((canvas) => {
    canvas.toBlob((blob) => saveAs(blob, "cashflow-screenshot.png"));
  });
}

// --- Event Listeners ---
document.getElementById("incomeBtn").addEventListener("click", () => addTransaction("income"));
document.getElementById("expenseBtn").addEventListener("click", () => addTransaction("expense"));

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentFilter = btn.dataset.filter;
    monthlyHalf = null;
    document.getElementById("monthly-half").classList.toggle("hidden", currentFilter !== "monthly");
    fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
  });
});

document.querySelectorAll(".monthly-half-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    monthlyHalf = btn.dataset.half;
    fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
  });
});

document.getElementById("toggleView").addEventListener("click", () => {
  compactView = !compactView;
  fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
});

document.getElementById("clearAll").addEventListener("click", () => {
  if (confirm("Are you sure you want to delete all records?")) clearAllTransactions();
});

document.getElementById("applyRange").addEventListener("click", (e) => {
  e.preventDefault();
  dateRange.from = document.getElementById("dateFrom").value || null;
  dateRange.to = document.getElementById("dateTo").value || null;
  fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
});

// Search
document.getElementById("searchInput").addEventListener("input", (e) => {
  searchQuery = e.target.value;
  fetchTransactions().then(({ transactions }) => renderTransactions(transactions));
});

// Export buttons
document.getElementById("exportAll").addEventListener("click", () => exportData("all"));
document.getElementById("exportRange").addEventListener("click", () => exportData("range"));
document.getElementById("exportFilter").addEventListener("click", () => exportData("filter"));
document.getElementById("exportScreenshot").addEventListener("click", exportScreenshot);

// Init
(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
