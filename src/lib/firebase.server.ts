// src/lib/firebase.server.ts
import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)
    )
  });
}

export const firestore = admin.firestore();

// Export admin in case you need it
export default admin;
