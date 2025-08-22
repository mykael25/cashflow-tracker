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
    // file doesn't exist yet
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

function renderTransactions(transactions) {
  const list = document.getElementById("transaction-list");
  list.innerHTML = "";

  transactions.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = `${t.type}: ${t.amount} - ${t.note}`;
    list.appendChild(li);
  });
}

document.getElementById("transaction-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const amount = document.getElementById("amount").value;
  const type = document.getElementById("type").value;
  const note = document.getElementById("note").value;

  if (!amount) return alert("Please enter an amount");

  await addTransaction({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  document.getElementById("transaction-form").reset();
});

// Load existing ones at startup
(async () => {
  const { transactions } = await fetchTransactions();
  renderTransactions(transactions);
})();
