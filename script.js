import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ========= Dark mode toggle ========= */
const darkToggle = document.getElementById("darkToggle");
if (darkToggle) darkToggle.addEventListener("click", () => document.body.classList.toggle("dark"));

/* ========= Password toggle ========= */
window.togglePassword = function (id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
};

/* ========= Create account ========= */
const createForm = document.getElementById("createForm");
if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const birthday = document.getElementById("birthday").value;

    if (!username) return alert("Enter a username");
    if (password.length < 6) return alert("Password must be at least 6 characters");
    if (password !== confirmPassword) return alert("Passwords do not match");

    try {
      const email = `${username}@banana.com`;
      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCred.user.uid), {
        username,
        birthday,
        createdAt: new Date()
      });

      alert("Account created!");
      window.location.href = "login.html";
    } catch (err) {
      alert(err.message);
    }
  });
}

/* ========= Login ========= */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const email = `${username}@banana.com`;
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "home.html";
    } catch {
      alert("Invalid username or password");
    }
  });
}

/* ========= Protect home ========= */
const displayUser = document.getElementById("displayUser");
if (displayUser) {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
    else displayUser.textContent = user.email.split("@")[0];
  });
}

/* ========= Logout & navigation ========= */
window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

window.startGame = function (level) {
  localStorage.setItem("bananaLevel", String(level));
  window.location.href = "game.html";
};

window.goLeaderboard = function () {
  window.location.href = "leaderboard.html";
};

/* ============================================================
   BANANA FACTORY GAME
   MAIN API: Marc Conrad Banana API (puzzle + answer)
============================================================ */

const bananaImage = document.getElementById("bananaImage");
const scoreDisplay = document.getElementById("score");
const roundDisplay = document.getElementById("round");
const levelDisplay = document.getElementById("levelDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const statusText = document.getElementById("statusText");
const roundBarFill = document.getElementById("roundBarFill");
const packTarget = document.getElementById("packTarget");
const livesEl = document.getElementById("lives");

const optA = document.getElementById("optA");
const optB = document.getElementById("optB");
const optC = document.getElementById("optC");

let score = 0;
let round = 1;
let lives = 3;
let correctAnswer = null;
let options = {};
let timer = null;
let timeLeft = 0;

const level = parseInt(localStorage.getItem("bananaLevel") || "1", 10);
let maxRounds = 5;
let useTimer = false;
let timerSeconds = 0;

if (level === 1) { maxRounds = 5; useTimer = false; }
if (level === 2) { maxRounds = 10; useTimer = false; }
if (level === 3) { maxRounds = 15; useTimer = true; timerSeconds = 6; }

function setStatus(msg) { if (statusText) statusText.textContent = msg; }

function updateUI() {
  if (levelDisplay) levelDisplay.textContent = String(level);
  if (roundDisplay) roundDisplay.textContent = String(round);
  if (scoreDisplay) scoreDisplay.textContent = String(score);
  if (livesEl) livesEl.textContent = String(lives);

  if (roundBarFill) {
    const pct = Math.min(100, ((round - 1) / maxRounds) * 100);
    roundBarFill.style.width = pct + "%";
  }

  if (!useTimer && timerDisplay) timerDisplay.textContent = "";
}

function setOptionsUI() {
  if (!optA || !optB || !optC) return;
  optA.textContent = `A: ${options.A}`;
  optB.textContent = `B: ${options.B}`;
  optC.textContent = `C: ${options.C}`;
}

function startTimer() {
  clearInterval(timer);
  timeLeft = timerSeconds;
  if (timerDisplay) timerDisplay.textContent = `⏱ ${timeLeft}s`;

  timer = setInterval(() => {
    timeLeft--;
    if (timerDisplay) timerDisplay.textContent = `⏱ ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      applyResult(false, "⏱ Order timed out!");
    }
  }, 1000);
}

function generateOptions(correct) {
  const c = Number(correct);
  const pool = new Set([String(correct)]);

  if (!Number.isNaN(c)) {
    while (pool.size < 3) {
      const delta = Math.floor(Math.random() * 6) + 1;
      const sign = Math.random() > 0.5 ? 1 : -1;
      const candidate = c + sign * delta;
      if (candidate >= 0) pool.add(String(candidate));
    }
  } else {
    while (pool.size < 3) pool.add(String(Math.floor(Math.random() * 10)));
  }

  const arr = Array.from(pool).sort(() => Math.random() - 0.5);
  return { A: arr[0], B: arr[1], C: arr[2] };
}

async function fetchBananaPuzzle() {
  const res = await fetch("https://marcconrad.com/uob/banana/api.php", { cache: "no-store" });
  if (!res.ok) throw new Error("Banana API HTTP " + res.status);
  const data = await res.json();

  const imageUrl = data.question || data.image || data.img || null;
  const answer = String(data.solution ?? data.answer ?? data.correct ?? "");

  if (!answer) throw new Error("Banana API missing answer/solution");
  return { imageUrl, answer };
}

async function loadOrder() {
  if (!bananaImage) return;

  setStatus("📦 New order incoming…");
  bananaImage.style.opacity = "0.25";

  try {
    const { imageUrl, answer } = await fetchBananaPuzzle();
    correctAnswer = answer;

    if (packTarget) packTarget.textContent = correctAnswer;
    bananaImage.src = imageUrl || "https://upload.wikimedia.org/wikipedia/commons/8/8a/Banana-Single.jpg";

    options = generateOptions(correctAnswer);
    setOptionsUI();
    updateUI();

    bananaImage.onload = () => (bananaImage.style.opacity = "1");
    setStatus("✅ Pack the correct banana count!");

    if (useTimer) startTimer();
  } catch (err) {
    console.error(err);
    setStatus("❌ Banana API failed. Check console.");
    bananaImage.style.opacity = "1";
  }
}

window.chooseAnswer = function (key) {
  if (useTimer) clearInterval(timer);

  const picked = options[key];
  const isCorrect = picked === correctAnswer;
  applyResult(isCorrect, isCorrect ? "✅ Correct pack!" : "❌ Wrong pack!");
};

function applyResult(isCorrect, msg) {
  if (isCorrect) score++;
  else lives--;

  setStatus(msg);
  updateUI();

  setTimeout(() => {
    if (lives <= 0) return finishGame();
    round++;
    if (round > maxRounds) finishGame();
    else loadOrder();
  }, 450);
}

async function finishGame() {
  clearInterval(timer);

  const user = auth.currentUser;
  if (user) {
    await addDoc(collection(db, "leaderboard"), {
      username: user.email.split("@")[0],
      score,
      level,
      maxRounds,
      mode: "banana-factory",
      timestamp: new Date()
    });
  }

  alert(`Shift ended! Score: ${score} 🍌`);
  window.location.href = "leaderboard.html";
}

if (bananaImage) {
  updateUI();
  loadOrder();
}

/* ========= Leaderboard ========= */
const leaderboardList = document.getElementById("leaderboardList");
if (leaderboardList) {
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"));

  getDocs(q).then((snapshot) => {
    leaderboardList.innerHTML = "";
    snapshot.forEach((docSnap) => {
      const d = docSnap.data();
      const li = document.createElement("li");
      li.className = "lb-item";
      li.innerHTML = `
        <span class="lb-name">${d.username}</span>
        <span class="lb-meta">Lvl ${d.level}</span>
        <span class="lb-score">${d.score} 🍌</span>
      `;
      leaderboardList.appendChild(li);
    });
  });
}