// functions/src/firebaseAdmin.ts
import admin from "firebase-admin";
import { Firestore } from "@google-cloud/firestore";

if (!admin.apps.length) {
  admin.initializeApp();
}

// Export named export 'firestore' because your recalcQueue.ts expects:
// import { firestore as adminFirestore } from "./firebaseAdmin";
export const firestore = admin.firestore() as Firestore;

// Also export admin default in case other modules import it
export default admin;
