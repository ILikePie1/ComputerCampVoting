import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";


const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MAX_SCENARIOS = 15;
const LOCAL_VOTES_KEY = "multi-person-yes-no-votes-v1";

const scenarioList = document.querySelector("#scenarioList");
const emptyState = document.querySelector("#emptyState");
const statusMessage = document.querySelector("#statusMessage");

let activeScenarios = [];

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readLocalVotes() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_VOTES_KEY)) || {};
  } catch (error) {
    console.warn("Could not read local vote lock.", error);
    return {};
  }
}

function saveLocalVote(scenarioId, name, choice) {
  try {
    const votes = readLocalVotes();
    votes[scenarioId] = {
      name,
      choice,
      votedAt: new Date().toISOString()
    };
    localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
  } catch (error) {
    console.warn("Could not save local vote lock.", error);
  }
}

function getStoredVote(scenarioId, name) {
  const storedVote = readLocalVotes()[scenarioId];

  if (!storedVote || storedVote.name !== name) {
    return null;
  }

  return storedVote;
}

function setScenarioButtonsDisabled(card, disabled) {
  card.querySelectorAll("button[data-choice]").forEach((button) => {
    button.disabled = disabled;
  });
}

async function submitVote(scenarioId, name, choice, card) {
  const storedVote = getStoredVote(scenarioId, name);

  if (storedVote) {
    setStatus(`This browser already voted ${storedVote.choice.toUpperCase()} for ${name}.`, "success");
    return;
  }

  setScenarioButtonsDisabled(card, true);
  setStatus(`Saving your ${choice.toUpperCase()} vote for ${name}...`);

  try {
    await update(ref(db), {
      [`votes/${scenarioId}/${choice}`]: increment(1)
    });

    saveLocalVote(scenarioId, name, choice);
    setStatus(`Thanks! Your ${choice.toUpperCase()} vote for ${name} was counted.`, "success");
    renderScenarioList(activeScenarios);
  } catch (error) {
    console.error(error);
    setScenarioButtonsDisabled(card, false);
    setStatus("Vote could not be saved. Check your Firebase config and database rules.", "error");
  }
}

function createScenarioCard({ id, name }) {
  const storedVote = getStoredVote(id, name);

  const card = document.createElement("article");
  card.className = "scenario-card";

  const header = document.createElement("div");
  header.className = "scenario-header";

  const meta = document.createElement("p");
  meta.className = "scenario-meta";
  meta.textContent = `Scenario ${id}`;

  const title = document.createElement("h2");
  title.textContent = name;

  header.append(meta, title);

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row compact";

  const yesButton = document.createElement("button");
  yesButton.className = "vote-button yes";
  yesButton.type = "button";
  yesButton.dataset.choice = "yes";
  yesButton.textContent = "Vote Yes";
  yesButton.addEventListener("click", () => submitVote(id, name, "yes", card));

  const noButton = document.createElement("button");
  noButton.className = "vote-button no";
  noButton.type = "button";
  noButton.dataset.choice = "no";
  noButton.textContent = "Vote No";
  noButton.addEventListener("click", () => submitVote(id, name, "no", card));

  buttonRow.append(yesButton, noButton);

  const voteState = document.createElement("p");
  voteState.className = "scenario-vote-state";

  if (storedVote) {
    yesButton.disabled = true;
    noButton.disabled = true;
    voteState.textContent = `This browser already voted ${storedVote.choice.toUpperCase()} for this person.`;
  } else {
    voteState.textContent = "Choose yes or no.";
  }

  card.append(header, buttonRow, voteState);
  return card;
}

function getActiveScenarios(scenariosData) {
  const scenarios = [];

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const name = normalizeName(scenariosData?.[id]?.name);

    if (name) {
      scenarios.push({ id: String(id), name });
    }
  }

  return scenarios;
}

function renderScenarioList(scenarios) {
  scenarioList.replaceChildren();
  emptyState.hidden = scenarios.length > 0;

  if (!scenarios.length) {
    setStatus("No active scenarios yet.");
    return;
  }

  scenarios.forEach((scenario) => {
    scenarioList.appendChild(createScenarioCard(scenario));
  });

  setStatus(`${scenarios.length} active scenario${scenarios.length === 1 ? "" : "s"} ready.`);
}

onValue(
  ref(db, "scenarios"),
  (snapshot) => {
    activeScenarios = getActiveScenarios(snapshot.val() || {});
    renderScenarioList(activeScenarios);
  },
  (error) => {
    console.error(error);
    setStatus("Could not load scenarios. Check your Firebase config and database rules.", "error");
  }
);
