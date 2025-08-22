/*********************
 * CONFIG
 *********************/
const repo = "mykael25/cashflow-tracker"; // <— change if your repo name/owner differs
const filePath = "data/transactions.json";
const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

/*********************
 * AUTH (no secrets in code)
 *********************/
let token = localStorage.getItem("gh_token");
if (!token) {
  token = prompt("Enter your GitHub Personal Access Token:");
  localStorage.setItem("gh_token", token);
}

/*********************
 * STATE
 *********************/
let transactionsCache = [];
let fileSha = null;
let chart; // Chart.js instance

/*********************
 * API HELPERS
 *********************/
async function fetchTransactions() {
  const res = await fetch(apiUrl, {
    headers: { Authorization: `token ${token}` },
  });

  if (res.status === 200) {
    const data = await res.json();
    fileSha = data.sha;
    const json = JSON.parse(atob(data.content.replace(/\n/g, "")));
    transactionsCache = Array.isArray(json) ? json : [];
  } else if (res.status === 404) {
    fileSha = null;
    transactionsCache = [];
  } else if (res.status === 401) {
    alert("Invalid/expired token. Please re-enter.");
    localStorage.removeItem("gh_token");
    location.reload();
    return;
  } else {
    const msg = await res.text();
    alert("Error fetching: " + msg);
  }
}

async function saveTransactions() {
  const payload = {
    message: "Update transactions.json",
    content: btoa(JSON.stringify(transactionsCache, null, 2)),
  };
  if (fileSha) payload.sha = fileSha;

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await res.json();
  if (res.ok) {
    fileSha = result.content?.sha || fileSha;
  } else {
    console.error("Save error:", result);
    alert("Failed to save. Check console.");
  }
}

/*********************
 * UTIL
 *********************/
function fmtDateISO(s) { return s.split("T")[0]; }
function peso(n) { return "₱" + Number(n).toFixed(2); }

function groupByMode(items, mode) {
  // return array of {label, items: [{...t, idx}]}
  const groups = new Map();
  items.forEach((t, idx) => {
    const d = new Date(t.date);
    let key;
    if (mode === "month") {
      key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    } else if (mode === "half") {
      const half = d.getDate() <= 15 ? "1–15" : "16–end";
      key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")} (${half})`;
    } else {
      key = "All";
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...t, idx });
  });

  // sort groups by label descending (most recent first) if not "All"
  const sorted = [...groups.entries()].sort((a,b) => {
    if (a[0]==="All") return -1;
    if (b[0]==="All") return 1;
    return a[0] < b[0] ? 1 : -1;
  });
  return sorted.map(([label, arr]) => ({ label, items: arr }));
}

function totals(items) {
  let inc = 0, exp = 0;
  items.forEach(t => {
    const v = parseFloat(t.amount) || 0;
    if (t.type === "income") inc += v; else exp += v;
  });
  return { income: inc, expense: exp, balance: inc - exp };
}

/*********************
 * RENDER: SUMMARY
 *********************/
function renderSummary(mode) {
  const el = document.getElementById("summary");
  el.innerHTML = "";

  const groups = groupByMode(transactionsCache, mode);
  // Overall totals (for current filter scope)
  const overall = totals(groups.flatMap(g => g.items));
  const overallRow = document.createElement("div");
  overallRow.className = "row";
  overallRow.innerHTML = `
    <div>
      <div class="meta">Overall (${mode === "month" ? "Monthly" : mode === "half" ? "Every 15 Days" : "All"})</div>
      <div>
        <span class="pill good">Income: ${peso(overall.income)}</span>
        &nbsp; <span class="pill bad">Expense: ${peso(overall.expense)}</span>
      </div>
    </div>
    <div class="pill" style="background:#eef2ff;color:#1e40af;">Balance: ${peso(overall.balance)}</div>
  `;
  el.appendChild(overallRow);

  // Per-group rows
  groups.forEach(g => {
    const t = totals(g.items);
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div>
        <div><strong>📅 ${g.label}</strong></div>
        <div class="meta">Income ${peso(t.income)} • Expense ${peso(t.expense)}</div>
      </div>
      <div class="pill" style="background:#f1f5f9;">${peso(t.balance)}</div>
    `;
    el.appendChild(row);
  });
}

/*********************
 * RENDER: LIST
 *********************/
function renderList(mode) {
  const wrap = document.getElementById("listContainer");
  wrap.innerHTML = "";

  const groups = groupByMode(transactionsCache, mode);
  groups.forEach(g => {
    const group = document.createElement("div");
    group.className = "group";

    const header = document.createElement("div");
    header.className = "group-header";
    header.textContent = g.label;
    group.appendChild(header);

    g.items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item";
      row.innerHTML = `
        <div class="main">
          <div class="amount ${item.type}">${item.type.toUpperCase()} • ${peso(item.amount)}</div>
          <div class="note">${item.note ? item.note : ""}</div>
          <div class="date">${fmtDateISO(item.date)}</div>
        </div>
        <div class="actions">
          <button class="del" title="Delete">✕</button>
        </div>
      `;
      // delete handler uses original index from cache
      row.querySelector(".del").addEventListener("click", async () => {
        if (!confirm("Delete this record?")) return;
        // Remove by original index
        transactionsCache.splice(item.idx, 1);
        await saveTransactions();
        await refresh(); // re-render using current mode
      });

      group.appendChild(row);
    });

    wrap.appendChild(group);
  });
}

/*********************
 * RENDER: CHART
 *********************/
function renderChart(mode) {
  const ctx = document.getElementById("groupChart");
  const groups = groupByMode(transactionsCache, mode);

  const labels = groups.map(g => g.label);
  const incomes = groups.map(g => totals(g.items).income);
  const expenses = groups.map(g => totals(g.items).expense);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Income", data: incomes },
        { label: "Expense", data: expenses }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true }
      },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${peso(ctx.parsed.y)}`
          }
        }
      }
    }
  });
}

/*********************
 * UI: MODAL / FORM
 *********************/
const modal = document.getElementById("modal");
const fab = document.getElementById("fab");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");
const amountInput = document.getElementById("amountInput");
const noteInput = document.getElementById("noteInput");
const groupSelect = document.getElementById("groupBy");

fab.addEventListener("click", () => {
  amountInput.value = "";
  noteInput.value = "";
  document.getElementById("typeIncome").checked = true;
  modal.classList.remove("hidden");
  amountInput.focus();
});
cancelBtn.addEventListener("click", () => modal.classList.add("hidden"));
modal.querySelector(".modal-backdrop").addEventListener("click", () => modal.classList.add("hidden"));

saveBtn.addEventListener("click", async () => {
  const amount = parseFloat(amountInput.value);
  const type = document.querySelector('input[name="type"]:checked').value;
  const note = noteInput.value.trim();

  if (!amount || amount <= 0) {
    alert("Amount must be greater than zero.");
    return;
  }

  transactionsCache.push({
    amount,
    type,
    note,
    date: new Date().toISOString(),
  });

  await saveTransactions();
  modal.classList.add("hidden");
  await refresh();
});

/*********************
 * UI: CONTROLS
 *********************/
document.getElementById("clearAllBtn").addEventListener("click", async () => {
  if (!transactionsCache.length) return;
  if (!confirm("Delete ALL records? This cannot be undone.")) return;
  transactionsCache = [];
  await saveTransactions();
  await refresh();
});

groupSelect.addEventListener("change", () => refreshRenderOnly());

/*********************
 * RENDER GLUE
 *********************/
function refreshRenderOnly() {
  const mode = groupSelect.value;
  renderSummary(mode);
  renderList(mode);
  renderChart(mode);
}

async function refresh() {
  // re-fetch to refresh SHA and consistent indexes
  await fetchTransactions();
  refreshRenderOnly();
}

/*********************
 * INIT
 *********************/
(async function init(){
  await fetchTransactions();
  refreshRenderOnly();
})();
