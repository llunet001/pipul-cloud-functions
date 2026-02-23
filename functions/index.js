const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const addMemberToGroup = require("./addMemberToGroup");
const groupNextState = require("./groupNextState");

exports.addMemberToGroup = addMemberToGroup;
exports.groupNextState = groupNextState;
