// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyApOFVY9sU5ifHheTnwoLv8xFnR8b9uTiw",
  authDomain: "staysmart-77486.firebaseapp.com",
  projectId: "staysmart-77486",
  storageBucket: "staysmart-77486.firebasestorage.app",
  messagingSenderId: "825095534050",
  appId: "1:825095534050:web:854f5ce083384f2536f5bb",
  measurementId: "G-9123Z2Y2V2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);

export const auth = getAuth(app);
export const storage = getStorage(app);