const admin = require('firebase-admin');

try {
  const fs = require('fs');
  const path = require('path');
  const serviceAccountPath = path.join(__dirname, '../../firebase-adminsdk.json');
  
  if (!admin.apps.length) {
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin initialized with local service account.");
    } else {
      // Fallback to default application credentials
      admin.initializeApp();
    }
  }
} catch (error) {
  console.warn("Firebase Admin initialization failed. Check credentials or ensure firebase-adminsdk.json is present.", error.message);
}

module.exports = admin;
