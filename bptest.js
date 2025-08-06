const { Client } = require('@botpress/client');
require('dotenv').config();

const bpclient = new Client({
  token: process.env.BOTPRESS_BEARER,
  botId: process.env.BOTPRESS_BOTID,
  workspaceId: process.env.BOTPRESS_WORKSPACEID,
});

module.exports.fetchBotpressData = async function (ingrdnt) {
  try {
    // First: Try searching in Ingredients
    let { rows } = await bpclient.findTableRows({
      table: 'Data1Table',
      filter: {
        Ingredients: { $regex: ingrdnt, $options: 'i' },
      },
    });

    // If no results, search in Alias
    if (rows.length === 0) {
      const aliasResult = await bpclient.findTableRows({
        table: 'Data1Table',
        filter: {
          Alias: { $regex: ingrdnt, $options: 'i' },
        },
      });

      rows = aliasResult.rows;
    }

    // Return first result (or null if empty)
    const firstResult = rows.length > 0 ? rows[0] : null;
    //console.log(firstResult.Summary);
    return firstResult && firstResult.Summary ? firstResult.Summary : null;
  } catch (error) {
    console.error('Error:', error);
  }
};
