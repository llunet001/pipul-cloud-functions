const {
  functions,
  db,
  admin,
  tasksClient,
  project,
  location,
  queueLocation,
  queueName,
  timeZone,
} = require("./config");

const { DateTime } = require("luxon");

module.exports = functions
  .region(location)
  .https.onRequest(async (req, res) => {
    const { groupId } = req.body?.data || {};

    if (!groupId) {
      return res.status(400).send("Missing groupId");
    }

    try {
      const groupRef = db.collection("groups").doc(groupId);
      const groupDoc = await groupRef.get();

      if (!groupDoc.exists) {
        return res.status(404).send("Group not found");
      }

      const groupData = groupDoc.data();
      const status = groupData.status;

      switch (status) {
        case "initialized":
          await updateGroupFromInitialized(groupId, groupData);
          break;
        case "voting":
          await updateGroupFromVoting(groupId, groupData);
          break;
        case "voted":
          await updateGroupFromVoted(groupId);
          break;
        case "done":
          await deleteGroup(groupId, groupData);
          break;
        default:
          return res.status(400).send("Invalid group status");
      }

      return res.status(200).send("Group status handled successfully");
    } catch (error) {
      console.error("Error handling group status:", error);
      return res.status(500).send("Internal server error");
    }
  });

async function updateGroupFromInitialized(groupId, groupData) {
  try {
    if (groupData.memberCount < 3) {
      return;
    } else {
      const groupRef = db.collection("groups").doc(groupId);
      await groupRef.update({ status: "voting" });
      console.log(`Group ${groupId} status updated to "voting".`);

      // Schedule groupNextState execution
      const queue = queueName;
      const url = `https://${location}-${project}.cloudfunctions.net/groupNextState`;
      const payload = {
        data: {
          groupId: groupId,
        },
      };

      const parent = tasksClient.queuePath(project, queueLocation, queue);

      // Determine the schedule time
      const now = DateTime.now().setZone(timeZone);
      let scheduleTime;
      if (now.hour >= 0 && now.hour < 14) {
        // Today at 17:00 Paris time
        scheduleTime = now.set({
          hour: 17,
          minute: 0,
          second: 0,
          millisecond: 0,
        });
      } else {
        // Tomorrow at 15:00 Paris time
        scheduleTime = now
          .plus({ days: 1 })
          .set({ hour: 15, minute: 0, second: 0, millisecond: 0 });
      }
      const scheduleTimeSeconds = Math.floor(scheduleTime.toUTC().toSeconds());

      const task = {
        httpRequest: {
          httpMethod: "POST",
          url,
          headers: { "Content-Type": "application/json" },
          body: Buffer.from(JSON.stringify(payload)).toString("base64"),
          oidcToken: {
            serviceAccountEmail: `${project}@appspot.gserviceaccount.com`, // Default App Engine service account
          },
        },

        scheduleTime: {
          seconds: scheduleTimeSeconds,
        },
      };

      const [response] = await tasksClient.createTask({ parent, task });
      console.log(
        `Scheduled groupNextState for group ${groupId}:`,
        response.name,
      );
    }
  } catch (error) {
    console.error("Error updating group status:", error);
    throw new functions.https.HttpsError(
      "unknown",
      "Error updating from initialized",
      error,
    );
  }
}

async function updateGroupFromVoting(groupId, groupData) {
  try {
    const groupRef = db.collection("groups").doc(groupId);
    // Find location key with the most votes (uids)
    let votedLocation = null;
    let maxLocationVotes = -1;
    for (const [key, arr] of Object.entries(groupData.locations || {})) {
      if (arr.length > maxLocationVotes) {
        maxLocationVotes = arr.length;
        votedLocation = key;
      }
    }

    // Find time key with the most votes (uids)
    let votedTime = null;
    let maxTimeVotes = -1;
    for (const [key, arr] of Object.entries(groupData.times || {})) {
      if (arr.length > maxTimeVotes) {
        maxTimeVotes = arr.length;
        votedTime = key;
      }
    }

    // Update group with votedLocation and votedTime, and set status to "voted"
    await groupRef.update({
      status: "voted",
      votedLocation: votedLocation,
      votedTime: votedTime,
    });
    console.log(
      `Group ${groupId} status updated to "voted", votedLocation: ${votedLocation}, votedTime: ${votedTime}`,
    );

    // Schedule groupNextState execution
    const queue = queueName;
    const url = `https://${location}-${project}.cloudfunctions.net/groupNextState`;
    const payload = {
      data: {
        groupId: groupId,
      },
    };

    const parent = tasksClient.queuePath(project, queueLocation, queue);

    // Determine the schedule time
    const now = DateTime.now().setZone(timeZone);
    const scheduleTimeSeconds = Math.floor(
      now.plus({ hours: 24 }).toUTC().toSeconds(),
    );

    const task = {
      httpRequest: {
        httpMethod: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        oidcToken: {
          serviceAccountEmail: `${project}@appspot.gserviceaccount.com`, // Default App Engine service account
        },
      },

      scheduleTime: {
        seconds: scheduleTimeSeconds,
      },
    };

    const [response] = await tasksClient.createTask({ parent, task });
    console.log(
      `Scheduled groupNextState for group ${groupId}:`,
      response.name,
    );
  } catch (error) {
    console.error("Error updating group status:", error);
    throw new functions.https.HttpsError(
      "unknown",
      "Error updating from initialized",
      error,
    );
  }
}

//TODO: Update group status from voted to done

async function updateGroupFromVoted(groupId) {
  try {
    const groupRef = db.collection("groups").doc(groupId);
    await groupRef.update({ status: "done" });
    console.log(`Group ${groupId} status updated to "done".`);

    // Schedule groupNextState execution
    const queue = queueName;
    const url = `https://${location}-${project}.cloudfunctions.net/groupNextState`;
    const payload = {
      data: {
        groupId: groupId,
      },
    };

    const parent = tasksClient.queuePath(project, queueLocation, queue);

    // Determine the schedule time
    const now = DateTime.now().setZone(timeZone);
    const scheduleTimeSeconds = Math.floor(
      now.plus({ hours: 24 }).toUTC().toSeconds(),
    );

    const task = {
      httpRequest: {
        httpMethod: "POST",
        url,
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify(payload)).toString("base64"),
        oidcToken: {
          serviceAccountEmail: `${project}@appspot.gserviceaccount.com`, // Default App Engine service account
        },
      },

      scheduleTime: {
        seconds: scheduleTimeSeconds,
      },
    };

    const [response] = await tasksClient.createTask({ parent, task });
    console.log(
      `Scheduled groupNextState for group ${groupId}:`,
      response.name,
    );
  } catch (error) {
    console.error("Error updating group status:", error);
    throw new functions.https.HttpsError(
      "unknown",
      "Error updating from voted",
      error,
    );
  }
}

//TODO: Delete group when done

async function deleteGroup(groupId, groupData) {
  try {
    const members = Array.isArray(groupData.members) ? groupData.members : [];
    if (members.length > 0) {
      const batch = db.batch();
      members.forEach((memberId) => {
        const userRef = db.collection("users").doc(memberId);
        batch.update(userRef, {
          groups: admin.firestore.FieldValue.arrayRemove(groupId),
        });
      });
      await batch.commit();
    }

    const groupRef = db.collection("groups").doc(groupId);
    await groupRef.delete();
    console.log(`Group ${groupId} deleted successfully.`);
  } catch (error) {
    console.error("Error deleting group:", error);
    throw new functions.https.HttpsError(
      "unknown",
      "Failed to delete group",
      error,
    );
  }
}
