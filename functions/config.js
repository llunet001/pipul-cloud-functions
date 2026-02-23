const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { CloudTasksClient } = require("@google-cloud/tasks");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
const location = process.env.FUNCTION_REGION || "europe-west1";
const queueLocation = process.env.TASKS_QUEUE_LOCATION || location;
const queueName = process.env.TASKS_QUEUE_NAME || "default";
const timeZone = process.env.DEFAULT_TIMEZONE || "Europe/Paris";
const tasksClient = new CloudTasksClient();

module.exports = {
  functions,
  db,
  admin,
  location,
  project,
  queueLocation,
  queueName,
  timeZone,
  tasksClient,
};
