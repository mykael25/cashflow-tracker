const repo = "mykael25/cashflow-tracker"; // change if needed
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

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
  const { sha, transactions } = await fetchTransactions();
  transactions.push(newTransaction);

  const result = await saveTransactions(transactions, sha);
  console.log("Update response:", result);

  renderTransactions(transactions);
}

async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);

  const result = await saveTransactions(transactions, sha);
  console.log("Delete response:", result);

  renderTransactions(transactions);
}

async function deleteAll() {
  const confirmDelete = confirm("Are you sure you want to delete ALL records?");
  if (!confirmDelete) return;

  const { sha } = await fetchTransactions();
  const result = await saveTransactions([], sha);
  console.log("Delete all response:", result);

  renderTransactions([]);
}

function calculateSummary(transactions, filter) {
  let filtered = [];

  if (filter === "monthly") {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    filtered = transactions.filter((t) => {
      const d = new Date(t.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  } else if (filter === "15days") {
    const now = new Date();
    const day = now.getDate();
    const startDay = day <= 15 ? 1 : 16;
    const endDay = day <= 15 ? 15 : new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    filtered = transactions.filter((t) => {
      const d = new Date(t.date);
      return (
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear() &&
        d.getDate() >= startDay &&
        d.getDate() <= endDay
      );
    });
  } else {
    filtered = transactions;
  }

  let income = 0;
  let expense = 0;
  filtered.forEach((t) => {
    if (t.type === "income") income += parseFloat(t.amount);
    else expense += parseFloat(t.amount);
  });

  return { income, expense, balance: income - expense };
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  const summary = document.getElementById("summary");
  const filter = document.getElementById("filter").value;

  list.innerHTML = "";

  transactions.forEach((t, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${t.date.split("T")[0]} | ${t.type.toUpperCase()}: ₱${t.amount} - ${t.note}
      <button onclick="deleteTransaction(${index})">❌</button>
    `;
    list.appendChild(li);
  });

  const totals = calculateSummary(transactions, filter);

  summary.innerHTML = `
    <p><strong>Total Income:</strong> ₱${totals.income.toFixed(2)}</p>
    <p><strong>Total Expense:</strong> ₱${totals.expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> ₱${totals.balance.toFixed(2)}</p>
  `;
}

document.getElementById("transaction-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.querySelector('input[name="type"]:checked').value;
  const note = document.getElementById("note").value;

  if (!amount || amount <= 0) return alert("Amount must be greater than zero");

  await addTransaction({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  document.getElementById("transaction-form").reset();
});

document.getElementById("filter").addEventListener("change", async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
});

document.getElementById("delete-all").addEventListener("click", deleteAll);

(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
