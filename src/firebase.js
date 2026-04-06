// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Replace this object with your actual config from the Firebase Console!
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// ==========================================
// 1. PRIMARY APP (For Admin Login & Database)
// ==========================================
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// ==========================================
// 2. SECONDARY APP (The "Trick" for creating accounts)
// ==========================================
// We name this one "SecondaryApp" so Firebase knows it's a background process.
const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");

// We export this specifically for the "Create HOD" and "Add Staff" buttons!
export const secondaryAuth = getAuth(secondaryApp);
