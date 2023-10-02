const { describe } = require('riteway')
const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('../scripts/helper')

const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names
var crypto = require('crypto');
const { create } = require('domain');
const createAccount = require('../scripts/createAccount');
const { title } = require('process');

const devKeyPair = {
   private: "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",  // local dev key
   public: "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
}
const newAccountPublicKey = devKeyPair.public

const randomAccountName = () => {
   let length = 12
   var result = '';
   var characters = 'abcdefghijklmnopqrstuvwxyz1234';
   var charactersLength = characters.length;
   for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   return result;
}

const randomSymbolName = (prefix) => {
   let length = 6
   var result = '';
   var characters = 'abcdefghijklmnopqrstuvwxyz1234'.toUpperCase();
   var charactersLength = characters.length;
   for (var i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   console.log("SYMBOL " + prefix + ": " + (prefix + result))
   return prefix + result;
}

const runAction = async ({ contractName = "dao.hypha", action, data, actor }) => {

   console.log("About to run action:", action, "with data:", JSON.stringify(data));

   actor = actor ?? contractName

   return eos.api.transact({
      actions: [{
         account: contractName,
         name: action,
         authorization: [{
            actor: actor,
            permission: 'active',
         }],
         data: data,
      }]
   }, {
      blocksBehind: 3,
      expireSeconds: 30,
   });
}

const getItem = (label, value, type = Types.String) => (
   {
      "label": label,
      "value": [
         type,
         value
      ]
   }
)

const Types = {
   Int: 'int64',
   String: 'string',
   Checksum: 'checksum256',
   Asset: 'asset',
   Name: 'name',
   TimePoint: 'time_point',
}

const setSetting = async (setting, value) => {
   return runAction({
      action: 'setsetting', data: {
         key: setting,
         value,
         group: null
      }
   });
}

const initializeDHO = async () => {

   result = await setSetting('governance_token_contract', [Types.Name, voice_token]);

   result = await setSetting('reward_token_contract', [Types.Name, hyphatoken]);

   result = await setSetting('peg_token_contract', [Types.Name, husd_token]);

   result = await setSetting('treasury_contract', [Types.Name, 'mttrsryhypha']);

   result = await setSetting('period_duration_sec', [Types.Int, 604800]);

   result = await setSetting('next_schedule_id', [Types.Int, parseInt(Math.random() * 1000000)]);

   result = await setSetting('init_period_count', [Types.Int, 10]); // optional - will use 30 if not set

   await sleep(1000);
}

const createMultipleAccounts = async (num) => {
   let result = []

   for (let i = 0; i < num; i++) {
      const member = randomAccountName()

      await createAccount({
         account: member,
         publicKey: newAccountPublicKey,
         creator: owner
      })

      result.push(member)
   }
   return result
}

const getLastDocuments = async (num) => {
   const data = await eos.getTableRows({
      code: daoContract,
      scope: daoContract,
      table: 'documents',
      limit: num,
      reverse: true,
      json: true,
   });
   return data.rows;
};


////////////////////////////////////////////////////////////////////////
/////////// Main unit test
////////////////////////////////////////////////////////////////////////

describe('run upvote election', async assert => {

   const test = badgeAssignmentPropData({
      assignee: "foo",
      badgeId: 1,
      badgeTitle: "foobar",
      startPeriodId: 20,
})

   if (!isLocal()) {
      console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
      return
   }

   const daoOwnerAccount = randomAccountName()
   const newDaoName = randomAccountName()

   console.log("New account " + daoOwnerAccount)
   console.log("New dao " + newDaoName)

   const contract = await eos.contract(daoContract)

   // create newaccount
   await createAccount({
      account: daoOwnerAccount,
      publicKey: newAccountPublicKey,
      creator: owner
   })
   await sleep(1000);

   // reset contract
   console.log("reset " + daoContract)
   await contract.reset({ authorization: `${daoContract}@active` })
   await sleep(500);

   // create root
   console.log("create root " + daoContract)
   await contract.createroot('test root', { authorization: `${daoContract}@active` });
   const docs = await getLastDocuments(5)
   console.log("badges initialized " + JSON.stringify(docs, null, 2))
   const delegateBadge = docs.find(item => JSON.stringify(item.content_groups).indexOf("Upvote Delegate Badge") != -1);
   const delegateBadgeId = delegateBadge.id
   // console.log("delegate badge " + JSON.stringify(delegateBadge, null, 2))
   // console.log("delegate badge id " + delegateBadgeId)
   const hasDelegateBadge = JSON.stringify(docs).indexOf("Upvote Delegate Badge") != -1;

   await sleep(1000);

   // init initial settings
   console.log("set intial settings ")
   await initializeDHO()


   console.log("create calendar ")
   await contract.createcalen(true, { authorization: `${daoContract}@active` })

   await sleep(1000);
   const docs2 = await getLastDocuments(30)
   const startPerString = "Calendar start period"
   const startPeriodDoc = docs2.find(item => JSON.stringify(item.content_groups).indexOf(startPerString) != -1);

   console.log("start period doc " + JSON.stringify(startPeriodDoc));

   // create dao
   console.log("create dao " + newDaoName + " with owner " + daoOwnerAccount)
   const daoParams = getCreateDaoData({
      dao_name: newDaoName,
      onboarder_account: daoOwnerAccount,
   })
   // console.log("DAO params " + JSON.stringify(params, null, 2))

   await contract.createdao(daoParams, { authorization: `${daoOwnerAccount}@active` });

   const getDaoEntry = async (daoName) => {
      const accountsTable = await eos.getTableRows({
         code: daoContract,
         scope: daoContract,
         table: 'daos',
         lower_bound: daoName,
         upper_bound: daoName,
         json: true
      });
      return accountsTable.rows[0];
   };

   const daoObj = await getDaoEntry(newDaoName)
   console.log("id: " + daoObj.id)

   assert({
      given: 'create dao',
      should: 'a new dao has been created',
      actual: daoObj.name,
      expected: newDaoName
   })

   assert({
      given: 'init dao root',
      should: 'has delegate badge',
      actual: hasDelegateBadge,
      expected: true,
   })

   assert({
      given: 'init calendars',
      should: 'has start period',
      actual: startPeriodDoc != undefined,
      expected: true,
   })

   const members = await createMultipleAccounts(30)

   console.log("created members: " + members)

   // ACTION autoenroll(uint64_t id, const name& enroller, const name& member);
   for (let member of members) {
      await contract.autoenroll(daoObj.id, daoOwnerAccount, member, { authorization: `${daoOwnerAccount}@active` });
      console.log("enrolled member: " + member)

      // Give the members delegate badges


      const badgeProposalData = badgeAssignmentPropData({
         assignee: member,
         badgeTitle: "Delegate Badge",
         badgeId: delegateBadge.id,
         startPeriodId: startPeriodDoc.id,
      })



      console.log("propose delegate badge for member: " + JSON.stringify(badgeProposalData, null, 2))
      //ACTION propose(uint64_t dao_id, const name &proposer, const name &proposal_type, ContentGroups &content_groups, bool publish);

      await contract.propose(
         daoObj.id,
         member,
         "assignbadge",
         badgeProposalData,
         true,
         { authorization: `${member}@active` }
      )

   }


   // Create an upvote election with short rounds

   // Read groups ?? and start voting
   // We could use the "print" outputs to figure out who's in which round
   // we need to get the member IDs of members to be able to vote for them
   // maybe that's in the members table?

   // Advance to the next round

   // Check winners each round until last round



})


const getCreateDaoData = ({
   dao_name,
   onboarder_account,
   voting_duration_sec = 604800,
   period_duration_sec = 604800,
}) => {
   return JSON.parse(`
  [
       [
          {
             "label":"content_group_label",
             "value":[
                "string",
                "details"
             ]
          },
          {
             "label":"dao_name",
             "value":[
                "name",
                "${dao_name}"
             ]
          },
          {
             "label":"dao_title",
             "value":[
                "string",
                "DAO title for ${dao_name}"
             ]
          },
          {
             "label":"dao_description",
             "value":[
                "string",
                "Dao Description Test"
             ]
          },
          {
             "label":"is_template",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"dao_template",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"voice_token",
             "value":[
                "asset",
                "1.00 VOICE"
             ]
          },
          {
             "label":"use_seeds",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"voting_duration_sec",
             "value":[
                "int64",
                "${voting_duration_sec}"
             ]
          },
          {
             "label":"period_duration_sec",
             "value":[
                "int64",
                "${period_duration_sec}"
             ]
          },
          {
             "label":"voting_alignment_x100",
             "value":[
                "int64",
                "80"
             ]
          },
          {
             "label":"voting_quorum_x100",
             "value":[
                "int64",
                "20"
             ]
          },
          {
             "label":"voice_token_decay_period",
             "value":[
                "int64",
                "604800"
             ]
          },
          {
             "label":"voice_token_decay_per_period_x10M",
             "value":[
                "int64",
                "100000"
             ]
          },
          {
             "label":"utility_token_multiplier",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"voice_token_multiplier",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"treasury_token_multiplier",
             "value":[
                "int64",
                "0"
             ]
          },
          {
             "label":"onboarder_account",
             "value":[
                "name",
                "${onboarder_account}"
             ]
          },
          {
             "label":"dao_url",
             "value":[
                "string",
                "dao_url_${dao_name}"
             ]
          },
          {
             "label":"skip_peg_token_create",
             "value":[
                "int64",
                "1"
             ]
          },
          {
             "label":"skip_reward_token_create",
             "value":[
                "int64",
                "1"
             ]
          }
       ],
       [
          {
             "label":"content_group_label",
             "value":[
                "string",
                "core_members"
             ]
          }
       ],
       [
          {
             "label":"content_group_label",
             "value":[
                "string",
                "style"
             ]
          },
          {
             "label":"logo",
             "value":[
                "string",
                ""
             ]
          },
          {
             "label":"primary_color",
             "value":[
                "string",
                "#242f5d"
             ]
          },
          {
             "label":"secondary_color",
             "value":[
                "string",
                "#3f64ee"
             ]
          },
          {
             "label":"text_color",
             "value":[
                "string",
                "#ffffff"
             ]
          }
       ]
    ]`)
}

const createDaoData = `

     [
        {
           "label":"content_group_label",
           "value":[
              "string",
              "details"
           ]
        },
        {
           "label":"dao_name",
           "value":[
              "name",
              "a11111111111"
           ]
        },
        {
           "label":"dao_title",
           "value":[
              "string",
              "DAO 1"
           ]
        },
        {
           "label":"dao_description",
           "value":[
              "string",
              "Dao Description 1"
           ]
        },
        {
           "label":"is_template",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"dao_template",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"voice_token",
           "value":[
              "asset",
              "1.00 VOICE"
           ]
        },
        {
           "label":"use_seeds",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"voting_duration_sec",
           "value":[
              "int64",
              "604800"
           ]
        },
        {
           "label":"period_duration_sec",
           "value":[
              "int64",
              "604800"
           ]
        },
        {
           "label":"voting_alignment_x100",
           "value":[
              "int64",
              "80"
           ]
        },
        {
           "label":"voting_quorum_x100",
           "value":[
              "int64",
              "20"
           ]
        },
        {
           "label":"voice_token_decay_period",
           "value":[
              "int64",
              "604800"
           ]
        },
        {
           "label":"voice_token_decay_per_period_x10M",
           "value":[
              "int64",
              "100000"
           ]
        },
        {
           "label":"utility_token_multiplier",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"voice_token_multiplier",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"treasury_token_multiplier",
           "value":[
              "int64",
              "0"
           ]
        },
        {
           "label":"onboarder_account",
           "value":[
              "name",
              "owner"
           ]
        },
        {
           "label":"dao_url",
           "value":[
              "string",
              "dao1_dao_short_url"
           ]
        },
        {
           "label":"skip_peg_token_create",
           "value":[
              "int64",
              "1"
           ]
        },
        {
           "label":"skip_reward_token_create",
           "value":[
              "int64",
              "1"
           ]
        }
     ],
     [
        {
           "label":"content_group_label",
           "value":[
              "string",
              "core_members"
           ]
        }
     ],
     [
        {
           "label":"content_group_label",
           "value":[
              "string",
              "style"
           ]
        },
        {
           "label":"logo",
           "value":[
              "string",
              ""
           ]
        },
        {
           "label":"primary_color",
           "value":[
              "string",
              "#242f5d"
           ]
        },
        {
           "label":"secondary_color",
           "value":[
              "string",
              "#3f64ee"
           ]
        },
        {
           "label":"text_color",
           "value":[
              "string",
              "#ffffff"
           ]
        }
     ]
  ]`

const badgeAssignmentPropData = ({ assignee, badgeTitle, badgeId, startPeriodId }) => JSON.parse(`
[
   [
     {
       "value": [
         "string",
         "details"
       ],
       "label": "content_group_label"
     },
     {
       "label": "assignee",
       "value": [
         "name",
         "${assignee}"
       ]
     },
     {
       "value": [
         "string",
         "${badgeTitle}"
       ],
       "label": "title"
     },
     {
       "value": [
         "string",
         "This badge ensures that the organization is aligned with our shared vision and goals. In case of misalignment, the holder has the power to negate a positive outcome of a proposal."
       ],
       "label": "description"
     },
     {
       "label": "badge",
       "value": [
         "int64",
         ${badgeId}
       ]
     },
     {
       "value": [
         "int64",
         ${startPeriodId}
       ],
       "label": "start_period"
     },
     {
       "label": "period_count",
       "value": [
         "int64",
         24
       ]
     }
   ]
 ]`)