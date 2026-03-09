import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDB2WMbqxhjN9Plat4Oa0eainnrxbOfz-Y",
  authDomain: "poker-irl.firebaseapp.com",
  projectId: "poker-irl",
  storageBucket: "poker-irl.firebasestorage.app",
  messagingSenderId: "1026717651463",
  appId: "1:1026717651463:web:dc7a8eea9c636b26b7d0a2"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

signInAnonymously(auth).catch(console.error);

export default app;