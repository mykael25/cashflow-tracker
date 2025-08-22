const repo = "mykael25/cashflow-tracker"; 
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
  if (newTransaction.amount <= 0) {
    alert("Amount must be greater than 0!");
    return;
  }

  const { sha, transactions } = await fetchTransactions();
  transactions.push(newTransaction);

  const result = await saveTransactions(transactions, sha);
  console.log("Update response:", result);

  renderTransactions(transactions);
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

function groupTransactions(transactions, groupBy) {
  if (groupBy === "all") return { "All Transactions": transactions };

  let grouped = {};

  transactions.forEach((t) => {
    let date = new Date(t.date);
    let key = "";

    if (groupBy === "month") {
      key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    } else if (groupBy === "halfmonth") {
      let half = date.getDate() <= 15 ? "1-15" : "16-end";
      key = `${date.getFullYear()}-${date.getMonth() + 1} (${half})`;
    }

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return grouped;
}

function renderTransactions(transactions) {
  const listContainer = document.getElementById("transactions-container");
  const summary = document.getElementById("summary");
  const groupBy = document.getElementById("group-by").value;

  listContainer.innerHTML = "";

  let income = 0, expense = 0;

  transactions.forEach((t) => {
    if (t.type === "income") income += parseFloat(t.amount);
    else expense += parseFloat(t.amount);
  });

  let balance = income - expense;
  summary.innerHTML = `
    <p><strong>Total Income:</strong> ₱${income.toFixed(2)}</p>
    <p><strong>Total Expense:</strong> ₱${expense.toFixed(2)}</p>
    <p><strong>Balance:</strong> ₱${balance.toFixed(2)}</p>
  `;

  let grouped = groupTransactions(transactions, groupBy);

  for (let group in grouped) {
    let groupDiv = document.createElement("div");
    groupDiv.className = "card";
    let title = document.createElement("h3");
    title.textContent = group;
    groupDiv.appendChild(title);

    grouped[group].forEach((t, i) => {
      let item = document.createElement("div");
      item.className = "transaction-item";
      item.innerHTML = `
        <span>${t.date.split("T")[0]} | ${t.type.toUpperCase()} ₱${t.amount} - ${t.note}</span>
        <button class="delete-btn" onclick="deleteTransaction(${i})">✖</button>
      `;
      groupDiv.appendChild(item);
    });

    listContainer.appendChild(groupDiv);
  }
}

document.getElementById("transaction-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.querySelector("input[name='type']:checked").value;
  const note = document.getElementById("note").value;

  await addTransaction({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  document.getElementById("transaction-form").reset();
});

document.getElementById("group-by").addEventListener("change", async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
});

document.getElementById("clear-all").addEventListener("click", clearAll);

(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
