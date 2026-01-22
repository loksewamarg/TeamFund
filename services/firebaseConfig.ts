import { initializeApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

// Configuration based on your provided screenshot
const firebaseConfig = {
  // ⚠️ CRITICAL: You must replace this with your actual Web API Key from the Firebase Console 
  // (Project Settings > General > Your apps > SDK setup and configuration)
  apiKey: "YOUR_API_KEY", 
  
  authDomain: "teamfund-b6c6a.firebaseapp.com",
  databaseURL: "https://teamfund-b6c6a-default-rtdb.firebaseio.com",
  projectId: "teamfund-b6c6a",
  storageBucket: "teamfund-b6c6a.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID", // Optional for Database only
  appId: "YOUR_APP_ID" // Optional for Database only
};

let app;
let db: Database | null = null;

// Initialize Firebase only if config is updated from placeholders
// Check if apiKey has been replaced (it's the most critical one)
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
    try {
        app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        console.log("TeamFund: Firebase initialized successfully for project teamfund-b6c6a.");
    } catch (e) {
        console.error("TeamFund: Firebase initialization failed.", e);
    }
} else {
    console.warn("TeamFund: Missing API Key. The app is in Offline Mode.");
    console.warn("Please open 'services/firebaseConfig.ts' and paste your Firebase API Key.");
}

export { db };