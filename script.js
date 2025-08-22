const repo = "mykael25/cashflow-tracker";
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

let chart; // chart instance

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

async function addTransaction(type) {
  const amount = document.getElementById("amount").value;
  const note = document.getElementById("note").value;

  if (!amount || parseFloat(amount) <= 0) {
    alert("Please enter a valid amount");
    return;
  }

  const { sha, transactions } = await fetchTransactions();
  transactions.push({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  await saveTransactions(transactions, sha);
  renderTransactions(transactions);

  document.getElementById("transaction-form").reset();
}

async function deleteTransaction(index) {
  const { sha, transactions } = await fetchTransactions();
  transactions.splice(index, 1);
  await saveTransactions(transactions, sha);
  renderTransactions(transactions);
}

async function clearAll() {
  if (!confirm("Are you sure you want to delete all records?")) return;
  await saveTransactions([], null);
  renderTransactions([]);
}

function groupTransactions(transactions, filter) {
  let grouped = {};
  transactions.forEach((t) => {
    let date = new Date(t.date);
    let key;

    if (filter === "monthly") {
      key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    } else if (filter === "15days") {
      let half = date.getDate() <= 15 ? "H1" : "H2";
      key = `${date.getFullYear()}-${date.getMonth() + 1}-${half}`;
    } else {
      key = "All";
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return grouped;
}

function renderChart(transactions) {
  const ctx = document.getElementById("chart").getContext("2d");

  if (chart) chart.destroy(); // prevent infinite growth

  const income = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const expense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  chart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense"],
      datasets: [
        {
          data: [income, expense],
          backgroundColor: ["#10B981", "#EF4444"],
        },
      ],
    },
  });
}

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  const summary = document.getElementById("summary");
  const filter = document.getElementById("filter").value;

  list.innerHTML = "";
  summary.innerHTML = "";

  let grouped = groupTransactions(transactions, filter);

  Object.keys(grouped).forEach((period) => {
    let group = grouped[period];
    let income = 0,
      expense = 0;

    const groupDiv = document.createElement("div");
    groupDiv.className = "mb-4";

    const header = document.createElement("h3");
    header.className = "font-bold mb-2";
    header.textContent = filter === "all" ? "All Transactions" : period;
    groupDiv.appendChild(header);

    const ul = document.createElement("ul");
    ul.className = "space-y-2";

    group.forEach((t, index) => {
      const li = document.createElement("li");
      li.className =
        "flex justify-between items-center p-2 border rounded";

      li.innerHTML = `
        <span>${t.date.split("T")[0]} | ${t.type.toUpperCase()}: ₱${t.amount} - ${t.note}</span>
        <button class="text-red-500 delete-btn" data-index="${index}">🗑</button>
      `;

      ul.appendChild(li);

      if (t.type === "income") income += parseFloat(t.amount);
      else expense += parseFloat(t.amount);
    });

    const totalP = document.createElement("p");
    totalP.className = "mt-2 text-sm text-gray-600";
    totalP.innerHTML = `<strong>Income:</strong> ₱${income.toFixed(
      2
    )} | <strong>Expense:</strong> ₱${expense.toFixed(
      2
    )} | <strong>Balance:</strong> ₱${(income - expense).toFixed(2)}`;

    groupDiv.appendChild(ul);
    groupDiv.appendChild(totalP);

    summary.appendChild(groupDiv);
  });

  renderChart(transactions);

  // delete buttons
  document.querySelectorAll(".delete-btn").forEach((btn, i) => {
    btn.addEventListener("click", () => deleteTransaction(i));
  });
}

// event listeners
document.getElementById("add-income").addEventListener("click", () => addTransaction("income"));
document.getElementById("add-expense").addEventListener("click", () => addTransaction("expense"));
document.getElementById("filter").addEventListener("change", async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
});
document.getElementById("clear-all").addEventListener("click", clearAll);

// init
(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
