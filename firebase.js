// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCGRj2ijsL8NoHpwGF-2dSRbR0-CafXJLY",
  authDomain: "banana-factory1.firebaseapp.com",
  projectId: "banana-factory1",
  storageBucket: "banana-factory1.firebasestorage.app",
  messagingSenderId: "194116988550",
  appId: "1:194116988550:web:6ced787fda94e8db8bab07"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);