const { functions, db, admin, location, project } = require("./config");
const fetch = require("node-fetch");

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function toLocationId(index) {
  return `location_${String(index).padStart(3, "0")}`;
}

module.exports = functions
  .region(location)
  .https.onCall(async (data, context) => {
    const { userId } = data;

    console.log("Function triggered with userId:", userId);

    if (!userId) {
      console.error("No userId provided.");
      return {
        success: false,
        code: "invalid-argument",
        error: "The function must be called with a userId.",
      };
    }

    try {
      console.log("Fetching user document...");
      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        console.error("User not found:", userId);
        throw new functions.https.HttpsError("not-found", "User not found.");
      }
      const newMember = userDoc.data();
      const userLocation = newMember.location;
      console.log("User document fetched successfully:", newMember);

      if (!userLocation) {
        console.error("User location not found in user document.");
        throw new functions.https.HttpsError(
          "failed-precondition",
          "User location is missing.",
        );
      }

      let currentGroup = null;

      console.log("Starting Firestore transaction...");
      await db.runTransaction(async (transaction) => {
        console.log("Querying groups with less than 5 members...");
        const groupsSnapshot = await db
          .collection("groups")
          .where("location", "==", userLocation)
          .where("memberCount", "<", 5)
          .limit(1)
          .get();

        if (!groupsSnapshot.empty) {
          console.log("Group found, checking if user is already a member...");
          const groupDoc = groupsSnapshot.docs[0];
          const groupRef = db.collection("groups").doc(groupDoc.id);
          currentGroup = groupDoc.id;
          const groupData = groupDoc.data();

          if (groupData.members.includes(userId)) {
            console.log(
              `User ${userId} is already a member of group ${currentGroup}. Creating a new group.`,
            );
          } else {
            console.log("Adding user to the existing group...");
            const updatedMembers = [...groupData.members, userId];
            transaction.update(groupRef, {
              members: updatedMembers,
              memberCount: admin.firestore.FieldValue.increment(1),
            });
            transaction.update(userRef, {
              groups: admin.firestore.FieldValue.arrayUnion(currentGroup),
              match_token: admin.firestore.FieldValue.increment(-1),
              is_matching: false,
            });
            console.log("Transaction completed successfully.");
            return Promise.resolve();
          }
        }
        console.log("No group found, creating a new group...");
        console.log(
          "Fetching location metadata for user location:",
          userLocation,
        );
        const userLocationDoc = await db
          .collection("locations")
          .doc(userLocation)
          .get();

        if (!userLocationDoc.exists) {
          console.error("User location document not found:", userLocation);
          throw new Error("User location document not found");
        }

        const userLocationData = userLocationDoc.data();
        const nb_locations = userLocationData.nb_locations;
        console.log("Available locations count:", nb_locations);

        if (!Number.isInteger(nb_locations) || nb_locations < 3) {
          console.error("Not enough locations available for user location.");
          throw new Error("Not enough locations available");
        }

        const selectedLocationIndexes = new Set();
        while (selectedLocationIndexes.size < 3) {
          selectedLocationIndexes.add(getRandomInt(1, nb_locations));
        }

        const selectedLocations = Array.from(selectedLocationIndexes).map(
          toLocationId,
        );
        console.log("Selected locations:", selectedLocations);

        const newGroupRef = db.collection("groups").doc();
        currentGroup = newGroupRef.id;
        console.log("Creating new group with ID:", currentGroup);

        transaction.set(newGroupRef, {
          location: userLocation,
          members: [],
          hasReadNewMessages: [],
          hasVoted: [],
          status: "initialized",
          memberCount: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          locations: {
            [selectedLocations[0]]: [],
            [selectedLocations[1]]: [],
            [selectedLocations[2]]: [],
          },
          times: {
            "18h": [],
            "19h": [],
            "20h": [],
          },
          votedLocation: null,
          votedTime: null,
        });

        transaction.update(newGroupRef, {
          members: admin.firestore.FieldValue.arrayUnion(userId),
        });

        const messagesRef = newGroupRef.collection("messages").doc("0");
        transaction.set(messagesRef, { messages: [] });
        console.log("New group created successfully.");

        console.log("Updating user document with group ID:", currentGroup);
        transaction.update(userRef, {
          groups: admin.firestore.FieldValue.arrayUnion(currentGroup),
          match_token: admin.firestore.FieldValue.increment(-1),
          is_matching: false,
        });

        console.log("Transaction completed successfully.");
        return Promise.resolve();
      });

      console.log(`Added ${userId} to group ${currentGroup} successfully.`);

      const groupNextStateUrl = `https://${location}-${project}.cloudfunctions.net/groupNextState`;
      try {
        await fetch(groupNextStateUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: { groupId: currentGroup } }),
        });
        console.log(`groupNextState called for group ${currentGroup}`);
      } catch (err) {
        console.error("Failed to call groupNextState:", err);
      }

      return {
        success: true,
        groupId: currentGroup,
      };
    } catch (error) {
      console.error("Error in Cloud Function:", error);
      return {
        success: false,
        code: error.code || "unknown",
        error: error.message || "Error adding member to group",
      };
    }
  });
