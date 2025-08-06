app.get('/get-communities', async (req, res) => {
  try {
    // Fetch all chats from the client
    const chats = await client.getChats();

    // Filter for communities (assuming Community class is available from PR #2531)
    const communities = chats.filter((chat) => chat.isCommunity);

    if (communities.length === 0) {
      res.status(404).send('No communities found.');
    } else {
      // Map community details: ID, name, and total participant count
      const communityList = await Promise.all(
        communities.map(async (community) => {
          // Fetch the total number of participants (including subgroups if applicable)
          const participants = await community.getParticipants();
          return {
            id: community.id._serialized,
            name: community.name,
            totalParticipants: participants.length,
          };
        }),
      );

      res.json(communityList);
    }
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).send('An error occurred while fetching communities.');
  }
});

app.get('/get-communities', async (req, res) => {
  console.log('inside get-communities');

  let community1;
  //community1 = await client.getChatById('120363284410601150@g.us');
  //console.log(community1);
  try {
    // Get all chats
    const chats = await client.getChats();
    //console.log(chats);

    // Filter for communities
    // Note: Based on the whatsapp-web.js documentation, we need to check for community type
    const communities = chats.filter((chat) => chat.isCommunity);
    console.log(communities);

    if (communities.length === 0) {
      return res.status(404).send('No communities found.');
    }

    // Process each community to get participant counts
    const communitiesWithParticipants = await Promise.all(
      communities.map(async (community) => {
        try {
          // Get community info including participants
          const communityInfo = await community.getInfo();

          // Get linked groups if available
          let linkedGroups = [];
          if (community.getLinkedGroups) {
            linkedGroups = await community.getLinkedGroups();
          }

          // Count total participants across all linked groups
          let totalParticipants = 0;

          // If getParticipants method is available, use it
          if (community.getParticipants) {
            const participants = await community.getParticipants();
            totalParticipants = participants.length;
          } else if (linkedGroups.length > 0) {
            // Otherwise, try to count participants from linked groups
            for (const group of linkedGroups) {
              const groupChat = await client.getChatById(group.id);
              const participants = await groupChat.getParticipants();
              totalParticipants += participants.length;
            }
          }

          return {
            id: community.id._serialized,
            name: community.name,
            description: communityInfo.description || '',
            totalParticipants: totalParticipants,
            linkedGroups: linkedGroups.map((group) => ({
              id: group.id._serialized,
              name: group.name,
            })),
          };
        } catch (err) {
          console.error(`Error processing community ${community.name}:`, err);
          return {
            id: community.id._serialized,
            name: community.name,
            error: 'Failed to fetch complete data',
            totalParticipants: 0,
          };
        }
      }),
    );

    res.json(communitiesWithParticipants);
  } catch (error) {
    console.error('Error fetching communities:', error);
    res.status(500).send('An error occurred while fetching communities.');
  }
});
