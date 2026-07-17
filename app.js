import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  getDatabase,
  ref,
  onValue,
  set,
  increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const MAX_SCENARIOS = 15;
const MAX_BROWSER_VOTES = 2;
const LOCAL_VOTES_KEY = "two-scenario-votes-v1";

const scenarioList = document.querySelector("#scenarioList");
const emptyState = document.querySelector("#emptyState");
const statusMessage = document.querySelector("#statusMessage");

let activeScenarios = [];
let isSavingVote = false;

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

function readLocalVotes() {
  try {
    const storedVotes = JSON.parse(localStorage.getItem(LOCAL_VOTES_KEY)) || {};
    return typeof storedVotes === "object" && !Array.isArray(storedVotes) ? storedVotes : {};
  } catch (error) {
    console.warn("Could not read local vote lock.", error);
    return {};
  }
}

function writeLocalVotes(votes) {
  try {
    localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
  } catch (error) {
    console.warn("Could not save local vote lock.", error);
  }
}

function saveLocalVote(scenarioId, name) {
  const votes = readLocalVotes();
  votes[scenarioId] = {
    name,
    votedAt: new Date().toISOString()
  };
  writeLocalVotes(votes);
}

function removeLocalVote(scenarioId) {
  const votes = readLocalVotes();
  delete votes[scenarioId];
  writeLocalVotes(votes);
}

function getStoredVote(scenarioId, name) {
  const storedVote = readLocalVotes()[scenarioId];

  if (!storedVote || storedVote.name !== name) {
    return null;
  }

  return storedVote;
}

function getCurrentBrowserVotes(scenarios = activeScenarios) {
  const localVotes = readLocalVotes();

  return scenarios.filter((scenario) => {
    const storedVote = localVotes[scenario.id];
    return storedVote && storedVote.name === scenario.name;
  });
}

function getRemainingVotes() {
  return Math.max(0, MAX_BROWSER_VOTES - getCurrentBrowserVotes().length);
}

function setAllVoteButtonsDisabled(disabled) {
  scenarioList.querySelectorAll("button[data-vote-scenario]").forEach((button) => {
    button.disabled = disabled;
  });
}

function pluralizeVote(count) {
  return `${count} vote${count === 1 ? "" : "s"}`;
}

async function toggleVote(scenarioId, name) {
  if (isSavingVote) {
    return;
  }

  const storedVote = getStoredVote(scenarioId, name);
  const isUnvoting = Boolean(storedVote);

  if (!isUnvoting && getRemainingVotes() <= 0) {
    setStatus("This browser has already used both votes. Unvote one scenario before voting for another.", "error");
    renderScenarioList(activeScenarios);
    return;
  }

  isSavingVote = true;
  setAllVoteButtonsDisabled(true);
  setStatus(isUnvoting ? `Removing your vote for ${name}...` : `Saving your vote for ${name}...`);

  try {
    await set(ref(db, `votes/${scenarioId}/count`), increment(isUnvoting ? -1 : 1));

    if (isUnvoting) {
      removeLocalVote(scenarioId);
      setStatus(`Your vote for ${name} was removed. You can vote for ${pluralizeVote(getRemainingVotes())}.`, "success");
    } else {
      saveLocalVote(scenarioId, name);
      setStatus(
        `Thanks! Your vote for ${name} was counted. You have ${pluralizeVote(getRemainingVotes())} remaining in this browser.`,
        "success"
      );
    }
  } catch (error) {
    console.error(error);
    setStatus("Vote change could not be saved. Check your Firebase config and database rules.", "error");
  } finally {
    isSavingVote = false;
    renderScenarioList(activeScenarios);
  }
}

function createScenarioCard({ id, name, description }) {
  const storedVote = getStoredVote(id, name);
  const usedVotes = getCurrentBrowserVotes().length;
  const remainingVotes = Math.max(0, MAX_BROWSER_VOTES - usedVotes);
  const limitReached = remainingVotes <= 0 && !storedVote;

  const card = document.createElement("article");
  card.className = `scenario-card ${storedVote ? "selected" : ""}`.trim();

  const header = document.createElement("div");
  header.className = "scenario-header";

  const titleGroup = document.createElement("div");

  const meta = document.createElement("p");
  meta.className = "scenario-meta";
  meta.textContent = `Scenario ${id}`;

  const title = document.createElement("h2");
  title.textContent = name;

  titleGroup.append(meta, title);
  header.append(titleGroup);

  const descriptionEl = document.createElement("p");
  descriptionEl.className = "scenario-description";
  descriptionEl.textContent = description || "No description provided.";

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row single";

  const voteButton = document.createElement("button");
  voteButton.className = `vote-button ${storedVote ? "unvote" : "vote"}`;
  voteButton.type = "button";
  voteButton.dataset.voteScenario = id;
  voteButton.textContent = storedVote ? "Unvote" : limitReached ? "Limit Reached" : "Vote";
  voteButton.disabled = Boolean(limitReached || isSavingVote);
  voteButton.addEventListener("click", () => toggleVote(id, name));

  buttonRow.append(voteButton);

  const voteState = document.createElement("p");
  voteState.className = "scenario-vote-state";

  if (storedVote) {
    voteState.textContent = "This browser voted for this scenario. Press Unvote to remove it.";
  } else if (limitReached) {
    voteState.textContent = "This browser has used both votes. Unvote another scenario to vote here.";
  } else {
    voteState.textContent = `You can still vote for ${pluralizeVote(remainingVotes)}.`;
  }

  card.append(header, descriptionEl, buttonRow, voteState);
  return card;
}

function getActiveScenarios(scenariosData) {
  const scenarios = [];

  for (let id = 1; id <= MAX_SCENARIOS; id += 1) {
    const name = normalizeName(scenariosData?.[id]?.name);
    const description = normalizeDescription(scenariosData?.[id]?.description);

    if (name) {
      scenarios.push({ id: String(id), name, description });
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

  const usedVotes = getCurrentBrowserVotes(scenarios).length;
  const remainingVotes = Math.max(0, MAX_BROWSER_VOTES - usedVotes);

  if (remainingVotes === 0) {
    setStatus(`You have used both votes in this browser. You can unvote a scenario to change your choices.`, "success");
  } else {
    setStatus(`${scenarios.length} active scenario${scenarios.length === 1 ? "" : "s"}. You can vote for ${pluralizeVote(remainingVotes)}.`);
  }
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
