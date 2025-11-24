// functions/src/firebaseAdmin.ts
import * as admin from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";
import * as functions from "firebase-functions";

// -------------------------------
// Load service account from Firebase config
// -------------------------------
let serviceAccountJson: any = undefined;

try {
  const raw = functions.config().service?.account;

  if (!raw) {
    console.warn("⚠️ No service.account found in Firebase Functions config.");
  } else {
    serviceAccountJson = JSON.parse(raw);
  }
} catch (err) {
  console.error("❌ Failed to parse service.account from config:", err);
}

// -------------------------------
// Initialize Admin SDK
// -------------------------------
if (!admin.apps.length) {
  if (serviceAccountJson) {
    // Use provided service account
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountJson),
    });
    console.log("✅ Firebase Admin initialized with service account from config");
  } else {
    // Fallback to default credentials (Cloud Functions env)
    admin.initializeApp();
    console.log("⚠️ Firebase Admin initialized with default credentials");
  }
}

export const firestore = admin.firestore() as Firestore;
export default admin;
