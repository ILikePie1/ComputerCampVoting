import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  update,
  increment
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

// 1. Replace this object with the config from your Firebase Web App settings.
// 2. Make sure databaseURL is included. You can find it in Realtime Database.
const firebaseConfig = {
  apiKey: "AIzaSyDT8Rl15reTRF15dIvlP9Vtv60OSCNP7VU",
  authDomain: "votingapp-4bda1.firebaseapp.com",
  databaseURL: "https://votingapp-4bda1-default-rtdb.firebaseio.com/",
  projectId: "votingapp-4bda1",
  storageBucket: "votingapp-4bda1.firebasestorage.app",
  messagingSenderId: "846612777368",
  appId: "1:846612777368:web:4c8aa1ee396b1bcb39c3ed",
  measurementId: "G-3Z25S1B8MW"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const votesRef = ref(db, "votes");

const yesButton = document.querySelector("#yesButton");
const noButton = document.querySelector("#noButton");
const statusMessage = document.querySelector("#statusMessage");
const yesCount = document.querySelector("#yesCount");
const noCount = document.querySelector("#noCount");
const totalCount = document.querySelector("#totalCount");
const yesPercent = document.querySelector("#yesPercent");
const noPercent = document.querySelector("#noPercent");
const yesBar = document.querySelector("#yesBar");
const noBar = document.querySelector("#noBar");

const LOCAL_VOTE_KEY = "yes-no-poll-vote";

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`.trim();
}

function toPercent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function renderVoteLock() {
  const previousVote = localStorage.getItem(LOCAL_VOTE_KEY);

  if (previousVote) {
    yesButton.disabled = true;
    noButton.disabled = true;
    setStatus(`This browser already voted ${previousVote.toUpperCase()}.`, "success");
  } else {
    yesButton.disabled = false;
    noButton.disabled = false;
  }
}

function renderCounts(votes) {
  const yes = Number(votes?.yes || 0);
  const no = Number(votes?.no || 0);
  const total = yes + no;
  const yesPct = toPercent(yes, total);
  const noPct = toPercent(no, total);

  yesCount.textContent = yes.toLocaleString();
  noCount.textContent = no.toLocaleString();
  totalCount.textContent = total.toLocaleString();

  yesPercent.textContent = `${yesPct}%`;
  noPercent.textContent = `${noPct}%`;
  yesBar.style.width = `${yesPct}%`;
  noBar.style.width = `${noPct}%`;
}

async function submitVote(choice) {
  const previousVote = localStorage.getItem(LOCAL_VOTE_KEY);

  if (previousVote) {
    setStatus(`This browser already voted ${previousVote.toUpperCase()}.`, "success");
    return;
  }

  yesButton.disabled = true;
  noButton.disabled = true;
  setStatus("Saving your vote...");

  try {
    await update(ref(db), {
      [`votes/${choice}`]: increment(1)
    });

    localStorage.setItem(LOCAL_VOTE_KEY, choice);
    setStatus(`Thanks! Your ${choice.toUpperCase()} vote was counted.`, "success");
  } catch (error) {
    console.error(error);
    setStatus("Vote could not be saved. Check your Firebase config and database rules.", "error");
    renderVoteLock();
  }
}

yesButton.addEventListener("click", () => submitVote("yes"));
noButton.addEventListener("click", () => submitVote("no"));

renderCounts({ yes: 0, no: 0 });
renderVoteLock();

onValue(
  votesRef,
  (snapshot) => {
    renderCounts(snapshot.val() || { yes: 0, no: 0 });

    if (!localStorage.getItem(LOCAL_VOTE_KEY)) {
      setStatus("Connected. Cast your vote.");
    }
  },
  (error) => {
    console.error(error);
    setStatus("Could not read the database. Check your Firebase config and rules.", "error");
  }
);
