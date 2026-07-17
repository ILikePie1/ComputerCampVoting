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
const resetAllToggle = document.querySelector("#resetAllToggle");
const resetAllButton = document.querySelector("#resetAllButton");

let scenariosData = {};
let votesData = {};
let unsubscribeScenarios = null;
let unsubscribeVotes = null;
let isSavingScenarioDetails = false;

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDescription(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getVoteNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return getVoteNumber(value).toLocaleString();
}

function getNewResetToken() {
  return Date.now();
}

async function resetScenarioVotes(scenarioId, resetToken = getNewResetToken()) {
  await Promise.all([
    set(ref(db, `votes/${scenarioId}/count`), 0),
    set(ref(db, `scenarios/${scenarioId}/resetAt`), resetToken)
  ]);
}

function buildScenarioInputs() {
  namesGrid.replaceChildren();

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const row = document.createElement("div");
    row.className = "name-input-row";

    const heading = document.createElement("span");
    heading.textContent = `Scenario ${id}`;

    const nameLabel = document.createElement("label");
    nameLabel.htmlFor = `scenarioName${id}`;
    nameLabel.textContent = "Name";

    const nameInput = document.createElement("input");
    nameInput.id = `scenarioName${id}`;
    nameInput.name = `scenarioName${id}`;
    nameInput.dataset.scenarioId = String(id);
    nameInput.dataset.field = "name";
    nameInput.type = "text";
    nameInput.maxLength = 80;
    nameInput.placeholder = "Person's name";

    const descriptionLabel = document.createElement("label");
    descriptionLabel.htmlFor = `scenarioDescription${id}`;
    descriptionLabel.textContent = "Short description";

    const descriptionInput = document.createElement("textarea");
    descriptionInput.id = `scenarioDescription${id}`;
    descriptionInput.name = `scenarioDescription${id}`;
    descriptionInput.dataset.scenarioId = String(id);
    descriptionInput.dataset.field = "description";
    descriptionInput.maxLength = 240;
    descriptionInput.rows = 3;
    descriptionInput.placeholder = "Optional short description";

    row.append(heading, nameLabel, nameInput, descriptionLabel, descriptionInput);
    namesGrid.appendChild(row);
  }
}

function populateScenarioInputs() {
  if (isSavingScenarioDetails) {
    return;
  }

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const nameInput = namesGrid.querySelector(`[data-scenario-id="${id}"][data-field="name"]`);
    const descriptionInput = namesGrid.querySelector(`[data-scenario-id="${id}"][data-field="description"]`);

    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = normalizeName(scenariosData?.[id]?.name);
    }

    if (descriptionInput && document.activeElement !== descriptionInput) {
      descriptionInput.value = normalizeDescription(scenariosData?.[id]?.description);
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
  const description = normalizeDescription(scenariosData?.[id]?.description);
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

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "result-description";
  descriptionEl.textContent = description || "No description set.";

  titleGroup.append(meta, title, descriptionEl);

  const badge = document.createElement("span");
  badge.className = `visibility-badge ${name ? "visible" : "hidden-slot"}`;
  badge.textContent = name ? "Visible" : "Hidden";

  topRow.append(titleGroup, badge);

  const counts = document.createElement("div");
  counts.className = "count-grid single";
  counts.append(createCountBox("Votes", total, "net total"));

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
      populateScenarioInputs();
      renderResults();
    },
    (error) => {
      console.error(error);
      setStatus("Could not read scenario names/descriptions. Check database rules.", "error");
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
  setStatus("Saving scenario details...");

  const scenarioDetails = [];

  // First capture every value from the form before any Firebase write starts.
  // This prevents live database listeners from repopulating later fields with
  // old values while multiple names/descriptions are being saved.
  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const nameInput = namesGrid.querySelector(`[data-scenario-id="${id}"][data-field="name"]`);
    const descriptionInput = namesGrid.querySelector(`[data-scenario-id="${id}"][data-field="description"]`);

    scenarioDetails.push({
      id: String(id),
      name: normalizeName(nameInput?.value),
      description: normalizeDescription(descriptionInput?.value)
    });
  }

  isSavingScenarioDetails = true;

  try {
    const saveJobs = [];

    for (const detail of scenarioDetails) {
      saveJobs.push(set(ref(db, `scenarios/${detail.id}/name`), detail.name || null));
      saveJobs.push(set(ref(db, `scenarios/${detail.id}/description`), detail.description || null));
    }

    await Promise.all(saveJobs);
    setStatus("Scenario details saved. Blank name slots are hidden from voters.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Could not save scenario details. Make sure this user UID is in /admins and rules are published.", "error");
  } finally {
    isSavingScenarioDetails = false;
    populateScenarioInputs();
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
    await resetScenarioVotes(scenarioId);
    setStatus(`Votes reset for ${name}. Voters can use that vote again.`, "success");
  } catch (error) {
    console.error(error);
    resetButton.disabled = false;
    setStatus("Could not reset votes. Make sure this user UID is in /admins.", "error");
  }
});

resetAllToggle.addEventListener("change", () => {
  resetAllButton.disabled = !resetAllToggle.checked;
});

resetAllButton.addEventListener("click", async () => {
  if (!resetAllToggle.checked) {
    return;
  }

  const confirmed = window.confirm("Reset all votes for all 15 scenarios? This will let browsers vote for up to 2 scenarios again.");

  if (!confirmed) {
    return;
  }

  resetAllButton.disabled = true;
  resetAllToggle.disabled = true;
  setStatus("Resetting all votes...");

  try {
    const resetToken = getNewResetToken();
    const resetJobs = [];

    for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
      resetJobs.push(resetScenarioVotes(String(id), resetToken));
    }

    await Promise.all(resetJobs);
    resetAllToggle.checked = false;
    setStatus("All votes were reset. Voters can vote for up to 2 scenarios again.", "success");
  } catch (error) {
    console.error(error);
    setStatus("Could not reset all votes. Make sure this user UID is in /admins.", "error");
  } finally {
    resetAllToggle.disabled = false;
    resetAllButton.disabled = true;
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
    populateScenarioInputs();
    renderResults();
    loginForm.hidden = false;
    adminPanel.hidden = true;
    resetAllToggle.checked = false;
    resetAllToggle.disabled = false;
    resetAllButton.disabled = true;
    setStatus("Not signed in.");
  }
});

buildScenarioInputs();
renderResults();
