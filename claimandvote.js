// This script works for multiple accounts to claim aether,
// increase claim limit, and auto vote claimed aether to a
// collection you choose.
// Credit to Van for the original script

// Change this to the collection you want to vote for
const VOTE_COLL = "gnomeseries1";

// Add as many claim accounts as you want (within reason)
const ACCOUNTS = [
  {
    username: "mywaxwallet1",
    pk: "privatekey1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    permission: "active",
    cost: 1000,
  },
  {
    username: "mywaxwallet2",
    pk: "privatekey2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    permission: "active",
    cost: 1000,
  },
];

const { Api, JsonRpc } = require("eosjs");
const { JsSignatureProvider } = require("eosjs/dist/eosjs-jssig");
const fetch = require("node-fetch");
const { TextDecoder, TextEncoder } = require("util");
const cron = require("node-cron");
const RPC = new JsonRpc("https://api.waxsweden.org/", { fetch });

const API = new Api({
  rpc: RPC,
  signatureProvider: new JsSignatureProvider(ACCOUNTS.map((x) => x.pk)),
  textDecoder: new TextDecoder(),
  textEncoder: new TextEncoder(),
});

console.log("Script started. Waiting for next claim...");
cron.schedule("15 * * * *", async () => {
  console.log("");
  for (let i = 0; i < ACCOUNTS.length; i++) {
    const account = ACCOUNTS[i];
    console.log("Account : ", account.username);

    const currentTime = Date.now();
    console.log("Current time : " + new Date(currentTime).toUTCString());

    // CLAIM AETHER
    try {
      await API.transact(
        {
          actions: [
            {
              account: "s.rplanet",
              name: "claim",
              authorization: [
                { actor: account.username, permission: account.permission },
              ],
              data: {
                to: account.username,
              },
            },
          ],
        },
        { blocksBehind: 0, expireSeconds: 60 }
      );
      console.log("Aether claimed successfully.");
    } catch (e) {
      console.log(e);
      console.log("ERROR CLAIMING AETHER!");
    }

    // INCREASE CLAIM LIMIT
    try {
      const r = await RPC.get_table_rows({
        json: true,
        code: "s.rplanet",
        scope: "s.rplanet",
        table: "claimlimits",
        lower_bound: account.username,
        limit: "1",
      });
      const lastExtendTime = parseInt(r.rows[0].extended_at) * 1000;
      const timeDiff = currentTime - lastExtendTime;

      if (timeDiff < 3300000) {
       console.log("LIMIT INCREASED WITHIN LAST HOUR!");
      } else {
        console.log(
          "Increasing claim limit, sending " +
            account.cost.toFixed(4) +
            " AETHER to s.rplanet..."
        );
        try {
          await API.transact(
            {
              actions: [
                {
                  account: "e.rplanet",
                  name: "transfer",
                  authorization: [
                    { actor: account.username, permission: account.permission },
                  ],
                  data: {
                    from: account.username,
                    to: "s.rplanet",
                    quantity: account.cost.toFixed(4) + " AETHER",
                    memo: "extend claim limit",
                  },
                },
              ],
            },
            { blocksBehind: 0, expireSeconds: 60 }
          );
          console.log("Claim limit extended successfully.");
        } catch (e) {
          console.log(e);
          console.log("ERROR EXTENDING CLAIM LIMIT!");
        }
      }
    } catch (e) {
      console.log(e);
      console.log("ERROR RETRIEVING CLAIM LIMIT DATA!");
    }


// AUTO VOTE  CLAIMED AETHER
    try {
      // wait for balance to update
      await new Promise((r) => setTimeout(r, 3000));

      let r = await RPC.get_currency_balance(
        "e.rplanet",
        account.username,
        "AETHER"
      );
      const aetherBalance = r[0];

   console.log("Voting " + aetherBalance + " for " + VOTE_COLL + "...");
      try {
        await API.transact(
          {
            actions: [
              {
                account: "e.rplanet",
                name: "transfer",
                authorization: [
                  { actor: account.username, permission: account.permission },
                ],
                data: {
                  from: account.username,
                  to: "s.rplanet",
                  quantity: aetherBalance,
                  memo: "vote:" + VOTE_COLL,
                },
              },
            ],
          },
          { blocksBehind: 0, expireSeconds: 60 }
        );
        console.log("Successfully voted for " + VOTE_COLL + ".");
      } catch (e) {
        console.log(e);
        console.log("ERROR TRANSFERRING AETHER FOR VOTE!");
      }
    } catch (e) {
      console.log(e);
      console.log("ERROR RETRIEVING AETHER BALANCE!");
    }

    console.log("...");
  }
});
