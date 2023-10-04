const { describe } = require('riteway')
const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('../scripts/helper')

const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names
var crypto = require('crypto');
const { create } = require('domain');
const createAccount = require('../scripts/createAccount');
const { title } = require('process');
const { updateDocumentCache, updateEdgesCache, documentCache, findEdgesByFromNodeAndEdgeName, edgesCache } = require('./docGraph');

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

const getBitcoinBlockHeader = async () => {
   var requestOptions = {
      method: 'GET',
      redirect: 'follow'
   };

   const rawResponse = await fetch("https://blockstream.info/api/blocks/tip/hash", requestOptions)
   const res = await rawResponse.text();
   return res;

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

   // console.locleg("About to run action:", action, "with data:", JSON.stringify(data));

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

describe('test stuff', async assert => {

   const foo = await getBitcoinBlockHeader()

   console.log("header: " + foo)

})
describe('run upvote election', async assert => {

   if (!isLocal()) {
      console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
      return
   }

   const daoOwnerAccount = randomAccountName()
   const newDaoName = randomAccountName()

   console.log("New account " + daoOwnerAccount)
   console.log("New dao " + newDaoName)

   const contract = await eos.contract(daoContract)

   // reset contract
   console.log("reset " + daoContract)
   await contract.reset({ authorization: `${daoContract}@active` })
   await sleep(500);

   // create newaccount
   await createAccount({
      account: daoOwnerAccount,
      publicKey: newAccountPublicKey,
      creator: owner
   })
   await sleep(1000);


   // create root
   console.log("create root " + daoContract)
   await contract.createroot('test root', { authorization: `${daoContract}@active` });
   const docs = await getLastDocuments(5)
   // console.log("badges initialized " + JSON.stringify(docs, null, 2))
   console.log("badges initialized ")
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
   console.log("DAO id: " + daoObj.id + " Name: " + newDaoName)

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

   // create an upvote election

   // ACTION createupvelc(uint64_t dao_id, ContentGroups& election_config)

   let now = new Date();
   let time = new Date(now.getTime() + 5000).toISOString()

   console.log("now: " + now.toISOString())
   console.log("up elec: " + time)
   // NOTE: The date string is "2023-10-03T03:39:53.250Z" but for some reason
   // eosjs insists of appending a 'Z' so we have to remove the Z first.
   if (time.endsWith("Z")) {
      time = time.slice(0, -1)
   }

   let data = upvoteElectionDoc(time)

   // console.log("elect data: \n" + JSON.stringify(data, null, 2) + "\n")
   console.log("create upvote election")
   const createTx = await contract.createupvelc(daoObj.id, data, { authorization: `${daoOwnerAccount}@active` })
   const consoleText = createTx.processed.action_traces[0].console;
   console.log("upvote election: " + JSON.stringify(consoleText, null, 2))

   const docs3 = await getLastDocuments(20)

   const electionDocType = "upvt.electn"
   const upElecDoc = docs3.find(item => JSON.stringify(item.content_groups).indexOf(electionDocType) != -1);
   console.log("election ID: " + upElecDoc.id)

   sleep(1000)

   // read all data into caches
   await updateDocumentCache()
   await updateEdgesCache()

   const ELECTION_EDGE = "ue.election"
   // inline constexpr auto UPCOMING_ELECTION = eosio::name("ue.upcoming");
   // inline constexpr auto ONGOING_ELECTION = eosio::name("ue.ongoing");
   // inline constexpr auto PREVIOUS_ELECTION = eosio::name("ue.previous");
   const START_ROUND = "ue.startrnd"
   // inline constexpr auto CURRENT_ROUND = eosio::name("ue.currnd");
   const ELECTION_ROUND = "ue.round"
   // inline constexpr auto ELECTION_ROUND_MEMBER = eosio::name("ue.rd.member");
   // inline constexpr auto ELECTION_GROUP_LINK = eosio::name("ue.group.lnk");
   // inline constexpr auto NEXT_ROUND = eosio::name("ue.nextrnd");
   // inline constexpr auto ROUND_CANDIDATE = eosio::name("ue.candidate");
   // inline constexpr auto ROUND_WINNER = eosio::name("ue.winner");
   // inline constexpr auto ELECTION_GROUP = eosio::name("ue.elctngrp");
   // inline constexpr auto UP_VOTE_VOTE = eosio::name("ue.vote");
   // inline constexpr auto UPVOTE_GROUP_WINNER = eosio::name("ue.winner");
   // inline constexpr auto VOTE = eosio::name("vote"); // ?? 
   // inline constexpr auto CHIEF_DELEGATE = eosio::name("ue.chiefdel");
   // inline constexpr auto HEAD_DELEGATE = eosio::name("ue.headdel");
   const electionEdge = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE)[0]
   const electionDoc = documentCache[electionEdge.to_node]
   console.log("election doc " + electionDoc.id)

   const startRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, START_ROUND)
   const electionRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, ELECTION_ROUND)

   assert({
      given: 'create upvote election',
      should: 'has start round',
      actual: startRoundEdges.length,
      expected: 1,
   })

   assert({
      given: 'create upvote election',
      should: 'has election round',
      actual: electionRoundEdges.length,
      expected: 1,
   })

   const startRoundEdge = startRoundEdges[0]
   const electionRoundEdge = electionRoundEdges[0]

   console.log("startRoundEdge " + JSON.stringify(startRoundEdge, null, 2))
   console.log("electionRoundEdge " + JSON.stringify(electionRoundEdge, null, 2))

   const startRound = documentCache[startRoundEdge.to_node]

   console.log("start round " + JSON.stringify(startRound))

   // console.log("all edges " + electionDoc.id + " " + JSON.stringify(edgesCache, null, 2))
   // console.log("all docs " + electionDoc.id + " " + JSON.stringify(documentCache, null, 2))

   // ACTION uesubmitseed(uint64_t dao_id, eosio::checksum256 seed, name account);
   const blockChainHeaderHash = await getBitcoinBlockHeader();
   console.log("latest block header: " + blockChainHeaderHash)

   const seedres = await contract.uesubmitseed(daoObj.id, blockChainHeaderHash, daoOwnerAccount, { authorization: `${daoOwnerAccount}@active` })
   const text2 = seedres.processed.action_traces[0].console;
   console.log("seedres: " + JSON.stringify(text2, null, 2))

   await updateDocumentCache()
   await updateEdgesCache()

   const electionDoc2 = documentCache[electionEdge.to_node]
   console.log("election doc " + JSON.stringify(electionDoc2, null, 2))

   assert({
      given: 'seed was set correctly',
      should: 'has election round',
      actual: JSON.stringify(electionDoc2, null, 2).indexOf(blockChainHeaderHash) != -1,
      expected: true,
   })


   /*
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

      //console.log("propose delegate badge for member: " + JSON.stringify(badgeProposalData, null, 2))
      //ACTION propose(uint64_t dao_id, const name &proposer, const name &proposal_type, ContentGroups &content_groups, bool publish);
      await contract.propose(
         daoObj.id,
         member,
         "assignbadge",
         badgeProposalData,
         true,
         { authorization: `${member}@active` }
      )
      console.log("added delegate badge for " + member)
   }
*/



   // kick off upvote election
   // ACTION updateupvelc(uint64_t election_id, bool reschedule);
   // await contract.updateupvelc(upElecDoc.id, false, { authorization: `${daoOwnerAccount}@active` });


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

const badgeAssignmentPropData = ({ assignee, badgeTitle, badgeId, startPeriodId }) => JSON.parse(`[
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
         "some text."
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

const upvoteElectionDoc = (time) => JSON.parse(`[
   [
       { "label": "content_group_label", "value": ["string", "details"] },
       { "label": "upvote_start_date_time", "value": ["time_point", "${time}"] },
       { "label": "upvote_duration", "value": ["int64", 7776000] },
       { "label": "duration", "value": ["int64", 3600] }
   ]
]`)

