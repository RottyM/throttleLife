
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    let credentials;
    if (process.env.NODE_ENV === 'production') {
      // For production environments like Vercel or Google Cloud,
      // use application default credentials.
      credentials = admin.credential.applicationDefault();
    } else {
      // For local development, use a service account key file.
      // Ensure you have this file in your project root and it's in .gitignore.
      try {
        const serviceAccount = require('../../service-account-key.json');
        credentials = admin.credential.cert(serviceAccount);
      } catch (e) {
        console.error(
          "Error: Could not find 'service-account-key.json' in the project root for local development." +
          "Please download it from your Firebase project settings."
        );
        // We throw an error that will be caught by the outer catch block
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


