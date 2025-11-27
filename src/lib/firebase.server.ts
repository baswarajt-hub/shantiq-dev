// src/lib/firebase.server.ts
import * as admin from 'firebase-admin';

/**
 * SAFE FIREBASE ADMIN INITIALIZER
 * Supports:
 * - FIREBASE_SERVICE_ACCOUNT as JSON string
 * - FIREBASE_SERVICE_ACCOUNT as Base64 encoded JSON
 * - Fallback to default app if already initialized
 */

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.warn(
      "⚠️ FIREBASE_SERVICE_ACCOUNT is missing. Using default credentials (only works locally with GOOGLE_APPLICATION_CREDENTIALS)."
    );
    return null;
  }

  try {
    // Try direct JSON string
    return JSON.parse(raw);
  } catch {
    try {
      // Try Base64 encoded JSON
      const decoded = Buffer.from(raw, "base64").toString("utf8");
      return JSON.parse(decoded);
    } catch {
      console.error("❌ Invalid FIREBASE_SERVICE_ACCOUNT format.");
      throw new Error("FIREBASE_SERVICE_ACCOUNT env var is invalid JSON.");
    }
  }
}

if (!admin.apps.length) {
  const serviceAccount = loadServiceAccount();

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    admin.initializeApp(); // fallback (local default creds)
  }
}

export const firestore = admin.firestore();
export const auth = admin.auth();
