import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

// Configuration uses environment variables for security.
// Ensure these are set in your deployment environment or .env file.
// const firebaseConfig = {
//   apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
//   authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
//   databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
//   projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.REACT_APP_FIREBASE_APP_ID
// };
const firebaseConfig =  {
  apiKey: "AIzaSyAgA9MvTJxOAJ8L5Vi86v9ctRqjySOhe7I",
  authDomain: "teamfund-b6c6a.firebaseapp.com",
  databaseURL: "https://teamfund-b6c6a-default-rtdb.firebaseio.com",
  projectId: "teamfund-b6c6a",
  storageBucket: "teamfund-b6c6a.firebasestorage.app",
  messagingSenderId: "455025307094",
  appId: "1:455025307094:web:0debc10f1e8f9f6fbbc877"
};
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
