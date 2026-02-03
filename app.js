const mockData = {
  queue: [
    {
      order: 1,
      name: "Daily News Summary",
      status: "running",
      next_run: "2026-02-03 07:30",
      last_run: "I dag 07:10",
      notes: "news_bot.py",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=7;BYMINUTE=30",
    },
    {
      order: 2,
      name: "Generate X Post",
      status: "ready",
      next_run: "2026-02-03 07:45",
      last_run: "I går 20:05",
      notes: "x_post.py",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=7;BYMINUTE=45",
    },
    {
      order: 3,
      name: "Trend Scan",
      status: "blocked",
      next_run: "2026-02-03 08:15",
      last_run: "I går 17:40",
      notes: "news_bot.py",
      rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;BYHOUR=8;BYMINUTE=15",
    },
    {
      order: 4,
      name: "Weekly Report",
      status: "ready",
      next_run: "2026-02-07 16:00",
      last_run: "Fredag 15:55",
      notes: "reporter.py",
      rrule: "FREQ=WEEKLY;BYDAY=FR;BYHOUR=16;BYMINUTE=0",
    },
  ],
  columns: [],
};

const statusLabels = {
  ready: "Klar",
  running: "Kører",
  blocked: "Blokeret",
};

const queueEl = document.getElementById("automationQueue");
const kanbanEl = document.getElementById("kanban");
const todayEl = document.getElementById("today");
const summaryEl = document.getElementById("summary");

function renderQueue(queue) {
  queueEl.innerHTML = queue
    .map(
      (item) => `
        <article class="queue-card">
          <div class="queue-order">#${item.order}</div>
          <div>
            <div class="card-title">${item.name}</div>
            <div class="card-meta">${item.notes || ""}</div>
            <div class="queue-meta">
              <span class="tag ${item.status}">${statusLabels[item.status] || "Status"}</span>
              <span class="tag">Næste: ${item.next_run || "Ukendt"}</span>
            </div>
            <div class="card-meta">Plan: ${item.rrule || ""}</div>
          </div>
          <div class="queue-action">${item.status === "blocked" ? "Kræver input" : "Afventer"}</div>
        </article>
      `
    )
    .join("");
}

function renderKanban(columns) {
  kanbanEl.innerHTML = columns
    .map(
      (col) => `
        <section class="column">
          <div class="column-title">
            <span>${col.column}</span>
            <span>${col.items.length}</span>
          </div>
          ${col.items
            .map(
              (item) => `
              <div class="card">
                <div class="card-title">${item.title}</div>
                <div class="card-meta">
                  <span>${item.tag}</span>
                  <span class="avatar">${item.owner}</span>
                </div>
                <div class="card-meta">Due: ${item.due}</div>
              </div>
            `
            )
            .join("")}
        </section>
      `
    )
    .join("");
}

function renderToday(queue, columns) {
  const blocked = queue.find((item) => item.status === "blocked");
  const inProgress = columns.find((col) => col.column.toLowerCase().includes("progress"));
  const next = queue[0];
  const items = [
    { label: "Næste automation", value: next ? `${next.name} ${next.next_run}` : "-" },
    { label: "Blokeret", value: blocked ? blocked.name : "Ingen" },
    {
      label: "In progress",
      value: inProgress ? `${inProgress.items.length} opgaver` : "0 opgaver",
    },
  ];

  todayEl.innerHTML = items
    .map(
      (item) => `
        <div class="today-item">
          <span>${item.label}</span>
          <strong>${item.value}</strong>
        </div>
      `
    )
    .join("");
}

function renderSummary(queue, columns) {
  const readyCount = queue.filter((item) => item.status === "ready").length;
  const totalTasks = columns.reduce((acc, col) => acc + col.items.length, 0);
  const summary = [
    { label: "Automations i kø", value: queue.length },
    { label: "Klar til kørsel", value: readyCount },
    { label: "Opgaver total", value: totalTasks },
    { label: "Team load", value: readyCount > 2 ? "Høj" : "Stabil" },
  ];

  summaryEl.innerHTML = summary
    .map(
      (item) => `
        <div class="summary-row">
          <span>${item.label}</span>
          <span>${item.value}</span>
        </div>
      `
    )
    .join("");
}

async function loadData() {
  try {
    const response = await fetch("data.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No data.json");
    const data = await response.json();
    return data;
  } catch (err) {
    return mockData;
  }
}

async function renderAll() {
  const data = await loadData();
  const queue = data.queue || [];
  const columns = data.columns || [];
  renderQueue(queue);
  renderKanban(columns);
  renderToday(queue, columns);
  renderSummary(queue, columns);
}

renderAll();

setInterval(renderAll, 60000);
