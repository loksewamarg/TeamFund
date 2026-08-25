import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Environment variable config with safe fallbacks
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "teamfund-b6c6a.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://teamfund-b6c6a-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "teamfund-b6c6a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "teamfund-b6c6a.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let app;
let db: Database | null = null;

// Initialize Firebase only if an actual API key is provided
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY" && !firebaseConfig.apiKey.includes("YOUR_")) {
    try {
        app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log(`TeamFund: Firebase connected to ${firebaseConfig.projectId}.`);
    } catch (e) {
        console.error("TeamFund: Firebase initialization failed.", e);
    }
} else {
    console.info("TeamFund: Firebase API Key not provided. Running in Offline Mode with LocalStorage.");
}

export { db };