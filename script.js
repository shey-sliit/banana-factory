/* Main script file - auth + game + leaderboard + settings */

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
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   MESSAGE SYSTEM (NEW)
========================= */
function showMessage(text, type = "error") {
  const box = document.getElementById("messageBox");
  if (!box) return;

  box.textContent = text;
  box.className = "message-box " + type;
  box.style.display = "block";

  setTimeout(() => {
    box.style.display = "none";
  }, 3000);
}

/* =========================
   LOAD SETTINGS
========================= */
const savedDark = localStorage.getItem("darkMode") === "true";
const savedSound = localStorage.getItem("sound") === "true";
const savedTimer = localStorage.getItem("timer") !== "false";

if (savedDark) document.body.classList.add("dark");

/* =========================
   DARK MODE
========================= */
const darkToggle = document.getElementById("darkToggle");

if (darkToggle) {
  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("darkMode", document.body.classList.contains("dark"));
  });
}

/* =========================
   PASSWORD TOGGLE
========================= */
window.togglePassword = function (id) {
  const input = document.getElementById(id);
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
};

/* =========================
   CREATE ACCOUNT
========================= */
const createForm = document.getElementById("createForm");

if (createForm) {
  createForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("newUsername").value.trim();
    const password = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;
    const birthday = document.getElementById("birthday").value;

    if (!username) return showMessage("Enter username");
    if (password.length < 6) return showMessage("Password must be 6+ characters");
    if (password !== confirm) return showMessage("Passwords do not match");

    try {
      const email = username + "@banana.com";

      const userCred = await createUserWithEmailAndPassword(auth, email, password);

      await setDoc(doc(db, "users", userCred.user.uid), {
        username,
        birthday,
        gamesPlayed: 0,
        bestScore: 0
      });

      showMessage("Account created successfully!", "success");

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);

    } catch (err) {
      showMessage(err.message);
    }
  });
}

/* =========================
   LOGIN
========================= */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      await signInWithEmailAndPassword(auth, username + "@banana.com", password);
      window.location.href = "home.html";
    } catch {
      showMessage("Invalid username or password");
    }
  });
}

/* =========================
   AUTH PROTECTION
========================= */
const displayUser = document.getElementById("displayUser");

if (displayUser) {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
    else displayUser.textContent = user.email.split("@")[0];
  });
}

/* =========================
   LOGOUT
========================= */
window.logout = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

/* =========================
   NAVIGATION
========================= */
window.startGame = (level) => {
  localStorage.setItem("bananaLevel", level);
  window.location.href = "game.html";
};

window.goLeaderboard = () => {
  window.location.href = "leaderboard.html";
};

/* =========================
   GAME LOGIC
========================= */

const bananaImage = document.getElementById("bananaImage");

if (bananaImage) {

  const scoreDisplay = document.getElementById("score");
  const roundDisplay = document.getElementById("round");
  const levelDisplay = document.getElementById("levelDisplay");
  const timerDisplay = document.getElementById("timerDisplay");

  const optA = document.getElementById("optA");
  const optB = document.getElementById("optB");
  const optC = document.getElementById("optC");

  const correctSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3");
  const wrongSound = new Audio("https://cdn.pixabay.com/audio/2022/03/15/audio_8b7b7c6e6b.mp3");

  let userInteracted = false;
  document.body.addEventListener("click", () => {
    userInteracted = true;
  }, { once: true });

  let score = 0;
  let round = 1;
  let lives = 3;
  let correctAnswer = "";
  let options = {};
  let timer;

  const level = parseInt(localStorage.getItem("bananaLevel") || "1");

  let maxRounds = level === 1 ? 5 : level === 2 ? 10 : 15;
  let useTimer = savedTimer;
  let timerSeconds = 6;

  if (levelDisplay) levelDisplay.textContent = level;

  function updateUI() {
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (roundDisplay) roundDisplay.textContent = round;
  }

  function generateOptions(correct) {
    const correctNum = Number(correct);
    const set = new Set([correctNum]);

    while (set.size < 3) {
      set.add(correctNum + Math.floor(Math.random() * 5) - 2);
    }

    const arr = Array.from(set).map(String).sort(() => Math.random() - 0.5);

    return { A: arr[0], B: arr[1], C: arr[2] };
  }

  function setOptionsUI() {
    optA.textContent = options.A;
    optB.textContent = options.B;
    optC.textContent = options.C;
  }

  async function loadBanana() {
    try {
      const res = await fetch("https://marcconrad.com/uob/banana/api.php", { cache: "no-store" });
      const data = await res.json();

      correctAnswer = String(data.solution ?? data.answer);
      bananaImage.src = data.question;

      options = generateOptions(correctAnswer);
      setOptionsUI();
      updateUI();

      if (useTimer) startTimer();

    } catch {
      showMessage("Failed to load question");
    }
  }

  function startTimer() {
    let time = timerSeconds;

    if (timerDisplay) timerDisplay.textContent = "Time: " + time;

    timer = setInterval(() => {
      time--;
      if (timerDisplay) timerDisplay.textContent = "Time: " + time;

      if (time <= 0) {
        clearInterval(timer);
        next(false);
      }
    }, 1000);
  }

  window.chooseAnswer = (key) => {
    clearInterval(timer);
    next(options[key] === correctAnswer);
  };

  function next(correct) {
    if (correct) {
      score++;
      if (savedSound && userInteracted) {
        correctSound.currentTime = 0;
        correctSound.play();
      }
    } else {
      lives--;
      if (savedSound && userInteracted) {
        wrongSound.currentTime = 0;
        wrongSound.play();
      }
    }

    if (lives <= 0 || round >= maxRounds) return finish();

    round++;
    loadBanana();
  }

  async function finish() {
    const user = auth.currentUser;

    if (user) {
      const userRef = doc(db, "users", user.uid);
      const snap = await getDoc(userRef);

      let gamesPlayed = 0;
      let bestScore = 0;

      if (snap.exists()) {
        const data = snap.data();
        gamesPlayed = data.gamesPlayed || 0;
        bestScore = data.bestScore || 0;
      }

      gamesPlayed++;
      if (score > bestScore) bestScore = score;

      await setDoc(userRef, { gamesPlayed, bestScore }, { merge: true });

      await addDoc(collection(db, "leaderboard"), {
        username: user.email.split("@")[0],
        score,
        level,
        timestamp: new Date()
      });
    }

    showMessage("Game Over! Score: " + score, "success");

    setTimeout(() => {
      window.location.href = "leaderboard.html";
    }, 1500);
  }

  loadBanana();
}

/* =========================
   LEADERBOARD
========================= */
const leaderboardList = document.getElementById("leaderboardList");

if (leaderboardList) {
  const q = query(collection(db, "leaderboard"), orderBy("score", "desc"));

  getDocs(q).then((snap) => {
    leaderboardList.innerHTML = "";
    let rank = 1;

    snap.forEach((docSnap) => {
      const d = docSnap.data();

      const li = document.createElement("li");
      li.innerHTML = `
        <span>${rank}</span>
        <span>${d.username}</span>
        <span>${d.level}</span>
        <span>${d.score} 🍌</span>
      `;

      leaderboardList.appendChild(li);
      rank++;
    });
  });
}

/* =========================
   PROFILE
========================= */
const profileName = document.getElementById("profileName");

if (profileName) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    document.getElementById("profileName").textContent = user.email.split("@")[0];
    document.getElementById("profileEmail").textContent = user.email;

    const snap = await getDoc(doc(db, "users", user.uid));

    if (snap.exists()) {
      const data = snap.data();

      document.getElementById("gamesPlayed").textContent = data.gamesPlayed || 0;
      document.getElementById("bestScore").textContent = data.bestScore || 0;
      document.getElementById("birthday").textContent = data.birthday || "Not set";
    }
  });
}

