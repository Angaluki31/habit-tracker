// ---------- DATA ----------
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// habits: [{ id, name, time, days: [1,3,5], created: "2026-10-15" }]
// log:    { "2026-10-15": [habitId, habitId] }  <- habits ticked on that date
let habits = JSON.parse(localStorage.getItem("habits")) || [];
let log = JSON.parse(localStorage.getItem("log")) || {};

function saveData() {
  localStorage.setItem("habits", JSON.stringify(habits));
  localStorage.setItem("log", JSON.stringify(log));
}

// ---------- HELPERS ----------
function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHTML(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Habits scheduled on a given date (right weekday AND already created by then)
function scheduledOn(date) {
  const key = dateKey(date);
  return habits
    .filter((h) => h.days.includes(date.getDay()) && h.created <= key)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function doneOn(date) {
  const ids = log[dateKey(date)] || [];
  return scheduledOn(date).filter((h) => ids.includes(h.id));
}

function isPerfectDay(date) {
  const scheduled = scheduledOn(date);
  return scheduled.length > 0 && doneOn(date).length === scheduled.length;
}

// ---------- STREAK ----------
// Streak = number of days in a row where ALL scheduled habits were completed.
// Days with no habits scheduled are rest days: they don't break the streak.
function getStreak() {
  let streak = 0;
  const day = new Date();

  // If today is not finished yet, don't punish the user: start from yesterday.
  if (!isPerfectDay(day)) day.setDate(day.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const scheduled = scheduledOn(day);
    if (scheduled.length > 0) {
      if (isPerfectDay(day)) streak++;
      else break;
    }
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

// ---------- ADD A HABIT ----------
const form = document.getElementById("habitForm");
const formError = document.getElementById("formError");
const dayBoxes = document.querySelectorAll(".days input");

document.getElementById("everyDay").addEventListener("click", () => {
  dayBoxes.forEach((box) => (box.checked = true));
});

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = document.getElementById("habitName").value.trim();
  const time = document.getElementById("habitTime").value;
  const days = [...dayBoxes].filter((b) => b.checked).map((b) => Number(b.value));

  if (days.length === 0) {
    formError.textContent = "Pick at least one day.";
    return;
  }
  formError.textContent = "";

  habits.push({
    id: Date.now().toString(),
    name,
    time,
    days,
    created: dateKey(),
  });

  saveData();
  form.reset();
  render();
});

// ---------- TICK / DELETE ----------
function toggleHabit(id) {
  const key = dateKey();
  const ids = log[key] || [];
  log[key] = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  saveData();
  render();
}

function deleteHabit(id) {
  if (!confirm("Delete this habit?")) return;
  habits = habits.filter((h) => h.id !== id);
  saveData();
  render();
}

// ---------- RENDER ----------
function renderToday() {
  const today = new Date();
  const list = document.getElementById("todayList");
  const scheduled = scheduledOn(today);
  const doneIds = log[dateKey(today)] || [];

  document.getElementById("todayDate").textContent =
    "- " + today.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });

  document.getElementById("emptyToday").style.display = scheduled.length ? "none" : "block";

  list.innerHTML = "";
  scheduled.forEach((h) => {
    const done = doneIds.includes(h.id);
    const li = document.createElement("li");
    if (done) li.classList.add("done");
    li.innerHTML = `
      <input type="checkbox" id="h-${h.id}" ${done ? "checked" : ""}>
      <label for="h-${h.id}" class="name">${escapeHTML(h.name)}</label>
      <span class="time">${h.time}</span>
    `;
    li.querySelector("input").addEventListener("change", () => toggleHabit(h.id));
    list.appendChild(li);
  });
}

function renderSummary() {
  const today = new Date();
  const total = scheduledOn(today).length;
  const done = doneOn(today).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById("doneCount").textContent = done;
  document.getElementById("totalCount").textContent = total;
  document.getElementById("todayBar").style.width = percent + "%";

  const msg = document.getElementById("dayMessage");
  if (total === 0) msg.textContent = "Nothing scheduled today. Add a habit to get started.";
  else if (done === total) msg.textContent = "Perfect day! You got 1% better today.";
  else if (done === 0) msg.textContent = "Start with one habit. Small steps count.";
  else msg.textContent = `${total - done} to go. Keep going!`;

  const streak = getStreak();
  document.getElementById("streakCount").textContent = streak;

  // 1% better every day: 1.01 ^ streak
  document.getElementById("growthScore").textContent = Math.pow(1.01, streak).toFixed(2);
}

function renderWeek() {
  const chart = document.getElementById("weekChart");
  chart.innerHTML = "";
  let sum = 0;
  let daysCounted = 0;

  for (let i = 6; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);

    const total = scheduledOn(day).length;
    const done = doneOn(day).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    if (total > 0) {
      sum += percent;
      daysCounted++;
    }

    const col = document.createElement("div");
    col.className = "col" + (i === 0 ? " today" : "");
    col.innerHTML = `
      <span class="pct">${total === 0 ? "-" : percent + "%"}</span>
      <div class="track"><div class="fill" style="height:${percent}%"></div></div>
      <span class="day">${DAY_NAMES[day.getDay()]}</span>
    `;
    chart.appendChild(col);
  }

  const avg = daysCounted === 0 ? 0 : Math.round(sum / daysCounted);
  document.getElementById("weekAverage").textContent =
    daysCounted === 0 ? "Your weekly average will show here." : `7-day average: ${avg}%`;
}

function renderAllHabits() {
  const list = document.getElementById("allHabits");
  list.innerHTML = "";

  if (habits.length === 0) {
    list.innerHTML = '<li class="empty">No habits yet.</li>';
    return;
  }

  habits.forEach((h) => {
    const dayText = [...h.days].sort().map((d) => DAY_NAMES[d]).join(", ");
    const li = document.createElement("li");
    li.innerHTML = `
      <div>${escapeHTML(h.name)}<small>${h.time} - ${dayText}</small></div>
      <button type="button">Delete</button>
    `;
    li.querySelector("button").addEventListener("click", () => deleteHabit(h.id));
    list.appendChild(li);
  });
}

function render() {
  renderToday();
  renderSummary();
  renderWeek();
  renderAllHabits();
}

render();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}