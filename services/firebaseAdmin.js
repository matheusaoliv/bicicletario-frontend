const admin = require('firebase-admin');

function loadServiceAccountFromEnv() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) return null;
  try {
    // Accept either raw JSON or base64-encoded JSON
    const maybeDecoded = json.trim().startsWith('{') ? json : Buffer.from(json, 'base64').toString('utf8');
    const parsed = JSON.parse(maybeDecoded);
    return parsed;
  } catch (_) {
    return null;
  }
}

let app;
function getApp() {
  if (app) return app;
  const sa = loadServiceAccountFromEnv();
  const projectId = process.env.FIREBASE_PROJECT_ID
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.GCLOUD_PROJECT
    || (sa && sa.project_id)
    || undefined;
  let storageBucket = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  if (!storageBucket && projectId) storageBucket = `${projectId}.appspot.com`;

  if (!admin.apps.length) {
    if (sa) {
      app = admin.initializeApp({
        credential: admin.credential.cert(sa),
        projectId,
        storageBucket,
      });
    } else {
      // Fallback: use ADC if provided by environment (e.g., GOOGLE_APPLICATION_CREDENTIALS)
      app = admin.initializeApp({
        projectId,
        storageBucket,
      });
    }
  } else {
    app = admin.app();
  }
  return app;
}

function getFirestore() {
  return getApp().firestore();
}

function getBucket() {
  return admin.storage().bucket();
}

module.exports = {
  admin,
  getApp,
  db: getFirestore(),
  bucket: getBucket(),
};
