const admin = require("firebase-admin");

// Initialize Firebase Admin if credentials are provided in env or a service account file
try {
  // If you have a service account JSON file, you can require it here or use GOOGLE_APPLICATION_CREDENTIALS
  // For now, we initialize only if there's a project ID or credentials to prevent crashing.
  if (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log(" Firebase Admin initialized successfully.");
  } else {
    console.warn(" Firebase Admin not initialized. Missing FIREBASE_PROJECT_ID or GOOGLE_APPLICATION_CREDENTIALS. Google login will be disabled.");
  }
} catch (error) {
  console.error(" Firebase Admin initialization error:", error);
}

module.exports = admin;
