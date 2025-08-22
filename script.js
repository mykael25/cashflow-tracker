const repo = "mykael25/expense-tracker"; // change USERNAME
const filePath = "data/transactions.json";
let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

async function fetchTransactions() {
  const res = await fetch(`https://raw.githubusercontent.com/${repo}/main/${filePath}`);
  return res.json();
}

async function updateTransactions(newData) {
  // Get current file SHA (needed by GitHub API)
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    headers: { Authorization: `token ${token}` }
  });
  const file = await res.json();

  await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Update transactions",
      content: btoa(JSON.stringify(newData, null, 2)),
      sha: file.sha
    })
  });
}

document.getElementById("expense-form").addEventListener("submit", async e => {
  e.preventDefault();
  const note = document.getElementById("note").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const type = document.getElementById("type").value;

  let data = await fetchTransactions();
  data.push({ type, amount, note, date: new Date().toISOString() });

  await updateTransactions(data);
  renderHistory(data);
});

async function renderHistory(data) {
  const history = document.getElementById("history");
  history.innerHTML = "";
  data.forEach(t => {
    const li = document.createElement("li");
    li.textContent = `${t.date.split("T")[0]} - ${t.type.toUpperCase()}: ${t.amount} (${t.note})`;
    history.appendChild(li);
  });
}

// Load on page open
fetchTransactions().then(renderHistory);
