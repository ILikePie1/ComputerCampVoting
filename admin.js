import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const MAX_SCENARIOS = 15;

const loginForm = document.querySelector("#adminLoginForm");
const adminPanel = document.querySelector("#adminPanel");
const emailInput = document.querySelector("#adminEmail");
const passwordInput = document.querySelector("#adminPassword");
const signOutButton = document.querySelector("#signOutButton");
const statusMessage = document.querySelector("#statusMessage");
const scenarioNamesForm = document.querySelector("#scenarioNamesForm");
const namesGrid = document.querySelector("#namesGrid");
const resultsGrid = document.querySelector("#resultsGrid");

let scenariosData = {};
let votesData = {};
let unsubscribeScenarios = null;
let unsubscribeVotes = null;

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getVoteNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getVoteNumber(value).toLocaleString();
}

function buildNameInputs() {
  namesGrid.replaceChildren();

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const label = document.createElement("label");
    label.className = "name-input-row";
    label.htmlFor = `scenarioName${id}`;

    const span = document.createElement("span");
    span.textContent = `Scenario ${id}`;

    const input = document.createElement("input");
    input.id = `scenarioName${id}`;
    input.name = `scenarioName${id}`;
    input.dataset.scenarioId = String(id);
    input.type = "text";
    input.maxLength = 80;
    input.placeholder = "Person's name";

    label.append(span, input);
    namesGrid.appendChild(label);
  }
}

function populateNameInputs() {
  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const input = namesGrid.querySelector(`[data-scenario-id="${id}"]`);

    if (input && document.activeElement !== input) {
      input.value = normalizeName(scenariosData?.[id]?.name);
    }
  }
}

function createCountBox(label, count, helper) {
  const box = document.createElement("div");
  box.className = "count-box";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  const strong = document.createElement("strong");
  strong.textContent = formatNumber(count);

  const helperEl = document.createElement("small");
  helperEl.textContent = helper;

  box.append(labelEl, strong, helperEl);
  return box;
}

function createResultCard(id) {
  const name = normalizeName(scenariosData?.[id]?.name);
  const total = getVoteNumber(votesData?.[id]?.count);

  const card = document.createElement("article");
  card.className = `result-card ${name ? "active" : "inactive"}`;

  const topRow = document.createElement("div");
  topRow.className = "result-top-row";

  const titleGroup = document.createElement("div");

  const meta = document.createElement("p");
  meta.className = "scenario-meta";
  meta.textContent = `Scenario ${id}`;

  const title = document.createElement("h3");
  title.textContent = name || "No name set";

  titleGroup.append(meta, title);

  const badge = document.createElement("span");
  badge.className = `visibility-badge ${name ? "visible" : "hidden-slot"}`;
  badge.textContent = name ? "Visible" : "Hidden";

  topRow.append(titleGroup, badge);

  const counts = document.createElement("div");
  counts.className = "count-grid single";
  counts.append(createCountBox("Votes", total, "total"));

  const resetButton = document.createElement("button");
  resetButton.className = "small-button danger";
  resetButton.type = "button";
  resetButton.dataset.resetVotes = String(id);
  resetButton.textContent = "Reset Votes";

  card.append(topRow, counts, resetButton);
  return card;
}

function renderResults() {
  resultsGrid.replaceChildren();

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    resultsGrid.appendChild(createResultCard(String(id)));
  }
}

function startAdminListeners() {
  stopAdminListeners();

  unsubscribeScenarios = onValue(
    ref(db, "scenarios"),
    (snapshot) => {
      scenariosData = snapshot.val() || {};
      populateNameInputs();
      renderResults();
    },
    (error) => {
      console.error(error);
      setStatus("Could not read scenario names. Check database rules.", "error");
    }
  );

  unsubscribeVotes = onValue(
    ref(db, "votes"),
    (snapshot) => {
      votesData = snapshot.val() || {};
      renderResults();
      setStatus("Signed in. Viewing live admin panel.", "success");
    },
    (error) => {
      console.error(error);
      setStatus("You are signed in, but not authorized to read vote totals. Check the /admins UID and rules.", "error");
    }
  );
}

function stopAdminListeners() {
  if (unsubscribeScenarios) {
    unsubscribeScenarios();
    unsubscribeScenarios = null;
  }

  if (unsubscribeVotes) {
    unsubscribeVotes();
    unsubscribeVotes = null;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Signing in...");

  try {
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    loginForm.reset();
  } catch (error) {
    console.error(error);
    setStatus("Sign-in failed. Check the email/password and Firebase Auth settings.", "error");
  }
});

scenarioNamesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Saving scenario names...");

  const saveJobs = [];

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const input = namesGrid.querySelector(`[data-scenario-id="${id}"]`);
    const name = normalizeName(input?.value);
    saveJobs.push(set(ref(db, `scenarios/${id}/name`), name || null));
  }

  try {
    await Promise.all(saveJobs);
    setStatus("Scenario names saved. Blank slots are hidden from voters.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Could not save scenario names. Make sure this user UID is in /admins.", "error");
  }
});

resultsGrid.addEventListener("click", async (event) => {
  const resetButton = event.target.closest("[data-reset-votes]");

  if (!resetButton) {
    return;
  }

  const scenarioId = resetButton.dataset.resetVotes;
  const name = normalizeName(scenariosData?.[scenarioId]?.name) || `Scenario ${scenarioId}`;
  const confirmed = window.confirm(`Reset all votes for ${name}?`);

  if (!confirmed) {
    return;
  }

  resetButton.disabled = true;
  setStatus(`Resetting votes for ${name}...`);

  try {
    await set(ref(db, `votes/${scenarioId}`), { count: 0 });
    setStatus(`Votes reset for ${name}.`, "success");
  } catch (error) {
    console.error(error);
    resetButton.disabled = false;
    setStatus("Could not reset votes. Make sure this user UID is in /admins.", "error");
  }
});

signOutButton.addEventListener("click", async () => {
  await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    loginForm.hidden = true;
    adminPanel.hidden = false;
    console.log("Signed-in Firebase UID:", user.uid);
    setStatus(`Signed in as ${user.email || "admin"}. UID: ${user.uid}. Loading admin data...`);
    startAdminListeners();
  } else {
    stopAdminListeners();
    scenariosData = {};
    votesData = {};
    populateNameInputs();
    renderResults();
    loginForm.hidden = false;
    adminPanel.hidden = true;
    setStatus("Not signed in.");
  }
});

buildNameInputs();
renderResults();
