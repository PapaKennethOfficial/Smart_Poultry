const admin = require('firebase-admin');

try {
  // To use this in production:
  // 1. Download your Firebase service account JSON file.
  // 2. Set the GOOGLE_APPLICATION_CREDENTIALS environment variable pointing to the file path.
  // OR provide the credential explicitly:
  // const serviceAccount = require('../../firebase-adminsdk.json');
  // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  if (!admin.apps.length) {
    admin.initializeApp();
  }
} catch (error) {
  console.warn("Firebase Admin initialization failed. Check credentials.", error.message);
}

module.exports = admin;
