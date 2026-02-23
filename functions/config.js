const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const location = process.env.FUNCTION_REGION || "europe-west1";

module.exports = {
  functions,
  db,
  admin,
  location,
  project,
};
