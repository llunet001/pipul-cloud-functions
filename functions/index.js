const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const addMemberToGroup = require("./addMemberToGroup");

exports.addMemberToGroup = addMemberToGroup;
