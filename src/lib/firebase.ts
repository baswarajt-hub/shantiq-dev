
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8m_n5cZmJbrbWWgbkeRX-tRe3PiUg7sg",
  authDomain: "shanti-clinic.firebaseapp.com",
  projectId: "shanti-clinic",
  storageBucket: "shanti-clinic.firebasestorage.app",
  messagingSenderId: "471443812255",
  appId: "1:471443812255:web:7dad9f21c92e07dfd997aa",
  measurementId: "G-QEQYJ547FS"
};

// Initialize Firebase
const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);


// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Initialize Analytics if supported
const analytics = isSupported().then(yes => yes ? getAnalytics(app) : null);

export { app, auth, db, analytics };
