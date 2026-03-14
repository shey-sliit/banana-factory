/* main script file for the Banana Factory game
   handles authentication, game logic and leaderboard */

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

/* dark mode toggle */

const darkToggle = document.getElementById("darkToggle");

if (darkToggle) {
  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
  });
}

/* show / hide password */

window.togglePassword = function (id) {
  const input = document.getElementById(id);

  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
  } else {
    input.type = "password";
  }
};

/* create account */

const createForm = document.getElementById("createForm");

if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const birthday = document.getElementById("birthday").value;

    if (!username) {
      alert("Enter a username");
      return;
    }

    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    try {
      // firebase needs email format so username is converted
      const email = username + "@banana.com";

      const userCredential =
        await createUserWithEmailAndPassword(auth, email, password);

      // save extra user data in firestore
      await setDoc(doc(db, "users", userCredential.user.uid), {
        username: username,
        birthday: birthday,
        createdAt: new Date()
      });

      alert("Account created!");
      window.location.href = "login.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

/* login */

const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const email = username + "@banana.com";

      await signInWithEmailAndPassword(auth, email, password);

      window.location.href = "home.html";
    } catch {
      alert("Invalid username or password");
    }
  });
}

/* protect home page */

const displayUser = document.getElementById("displayUser");

if (displayUser) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
    } else {
      displayUser.textContent = user.email.split("@")[0];
    }
  });
}

/* logout */

window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

/* page navigation */

window.startGame = function (level) {
  localStorage.setItem("bananaLevel", String(level));
  window.location.href = "game.html";
};

window.goLeaderboard = function () {
  window.location.href = "leaderboard.html";
};

/* game variables */

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
let correctAnswer = "";
let options = {};
let timer = null;
let timeLeft = 5;

/* get selected level */

const level = parseInt(localStorage.getItem("bananaLevel") || "1", 10);

let maxRounds = 5;
let useTimer = false;
let timerSeconds = 0;

if (level === 1) {
  maxRounds = 5;
  useTimer = false;
}

if (level === 2) {
  maxRounds = 10;
  useTimer = false;
}

if (level === 3) {
  maxRounds = 15;
  useTimer = true;
  timerSeconds = 6;
}

if (levelDisplay) {
  levelDisplay.textContent = level;
}

/* update text on screen */

function updateUI() {
  if (scoreDisplay) scoreDisplay.textContent = score;
  if (roundDisplay) roundDisplay.textContent = round;
  if (livesEl) livesEl.textContent = lives;
  if (levelDisplay) levelDisplay.textContent = level;

  if (roundBarFill) {
    const percent = ((round - 1) / maxRounds) * 100;
    roundBarFill.style.width = percent + "%";
  }
}

/* show message */

function setStatus(message) {
  if (statusText) statusText.textContent = message;
}

/* create number options */

function generateOptions(correct) {
  const correctNum = Number(correct);
  const values = new Set([String(correctNum)]);

  while (values.size < 3) {
    const randomOffset = Math.floor(Math.random() * 6) + 1;
    const randomSign = Math.random() > 0.5 ? 1 : -1;
    const newValue = correctNum + randomOffset * randomSign;

    if (newValue >= 0) {
      values.add(String(newValue));
    }
  }

  const shuffled = Array.from(values).sort(() => Math.random() - 0.5);

  return {
    A: shuffled[0],
    B: shuffled[1],
    C: shuffled[2]
  };
}

/* put options on buttons */

function setOptionsUI() {
  if (!optA || !optB || !optC) return;

  optA.textContent = options.A;
  optB.textContent = options.B;
  optC.textContent = options.C;
}

/* load puzzle from banana api */

async function loadBanana() {
  if (!bananaImage) return;

  setStatus("Loading order...");
  bananaImage.style.opacity = "0.25";

  try {
    const response = await fetch("https://marcconrad.com/uob/banana/api.php", {
      cache: "no-store"
    });

    const data = await response.json();

    correctAnswer = String(data.solution ?? data.answer ?? data.correct ?? "");

    bananaImage.src = data.question || data.image || data.img || "";

    // keep it hidden so the player solves it
    if (packTarget) packTarget.textContent = "?";

    // make multiple choice numbers
    options = generateOptions(correctAnswer);
    setOptionsUI();

    // random background from pexels
    const pexelsResponse = await fetch(
      "https://api.pexels.com/v1/search?query=fruit%20warehouse&per_page=20",
      {
        headers: {
          Authorization: "9ta9BdqkRRhJpMjKudTYdnAUAmbSr3lLR6pbFFx1RNyjUibkSh0BSbYq"
        }
      }
    );

    const pexelsData = await pexelsResponse.json();

    if (pexelsData.photos && pexelsData.photos.length > 0) {
      const randomImage =
        pexelsData.photos[Math.floor(Math.random() * pexelsData.photos.length)];

      const bg = document.querySelector(".background");

      if (bg) {
        bg.style.backgroundImage =
          `linear-gradient(-45deg, rgba(249,212,35,0.55), rgba(255,78,80,0.55), rgba(143,211,244,0.55), rgba(132,250,176,0.55)), url('${randomImage.src.large}')`;
        bg.style.backgroundSize = "cover";
        bg.style.backgroundPosition = "center";
      }
    }

    bananaImage.onload = () => {
      bananaImage.style.opacity = "1";
    };

    setStatus("Choose the correct number");
    updateUI();

    if (useTimer) {
      startTimer();
    }
  } catch (error) {
    console.error(error);
    alert("Error loading banana question");
  }
}

/* timer */

function startTimer() {
  clearInterval(timer);

  timeLeft = timerSeconds;

  if (timerDisplay) {
    timerDisplay.textContent = "Time: " + timeLeft;
  }

  timer = setInterval(() => {
    timeLeft--;

    if (timerDisplay) {
      timerDisplay.textContent = "Time: " + timeLeft;
    }

    if (timeLeft <= 0) {
      clearInterval(timer);
      applyResult(false, "Time ran out!");
    }
  }, 1000);
}

/* check selected option */

window.chooseAnswer = function (key) {
  if (useTimer) clearInterval(timer);

  const pickedAnswer = options[key];
  const isCorrect = pickedAnswer === correctAnswer;

  applyResult(isCorrect, isCorrect ? "Correct!" : "Wrong!");
};

/* update result */

function applyResult(isCorrect, message) {
  if (isCorrect) {
    score++;
  } else {
    lives--;
  }

  setStatus(message);
  updateUI();

  setTimeout(() => {
    if (lives <= 0) {
      finishGame();
      return;
    }

    round++;

    if (round > maxRounds) {
      finishGame();
    } else {
      loadBanana();
    }
  }, 500);
}

/* end game */

async function finishGame() {
  clearInterval(timer);

  const user = auth.currentUser;

  if (user) {
    await addDoc(collection(db, "leaderboard"), {
      username: user.email.split("@")[0],
      score: score,
      level: level,
      timestamp: new Date()
    });
  }

  alert("Game Over! Score: " + score);
  window.location.href = "leaderboard.html";
}

/* start game when page loads */

if (bananaImage) {
  updateUI();
  loadBanana();
}

/* show leaderboard */

const leaderboardList = document.getElementById("leaderboardList");

if (leaderboardList) {
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"));

  getDocs(q).then((snapshot) => {
    leaderboardList.innerHTML = "";

    if (snapshot.empty) {
      leaderboardList.innerHTML = "<li class='lb-item'>No scores yet.</li>";
      return;
    }

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      const li = document.createElement("li");
      li.className = "lb-item";

      const rank = leaderboardList.children.length + 1;

      li.innerHTML = `
        <span>${rank}</span>
        <span>${data.username}</span>
        <span>${data.level}</span>
        <span>${data.score} 🍌</span>
      `;

      leaderboardList.appendChild(li);
    });
  }).catch((error) => {
    console.error("Leaderboard error:", error);
  });
}