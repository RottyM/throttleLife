
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    let credentials: admin.credential.Credential;

    if (process.env.NODE_ENV === 'production') {
      // Production (e.g., Vercel/GCP): rely on application default credentials.
      credentials = admin.credential.applicationDefault();
    } else {
      // Local development: load the service account JSON from the repo root.
      try {
        const serviceAccount = require('../../service-account-key.json');
        credentials = admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error(
          "Error: Could not find 'service-account-key.json' in the project root for local development." +
            ' Please download it from your Firebase project settings.'
        );
        throw e;
      }
    }

    admin.initializeApp({
      credential: credentials,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (e) {
    console.error('Firebase admin initialization error:', (e as Error).message);
  }
}

export const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });
export const auth = admin.auth();


