#!/usr/bin/env node

// TODO
// Move this to scripts
// Move Docgraph helper classes to scripts / helpers

const program = require('commander')

const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('./helper')

const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names
var crypto = require('crypto');
const { create } = require('domain');
const createAccount = require('./createAccount');
const { title } = require('process');
const { 
   updateDocumentCache, 
   updateEdgesCache, 
   edgesCache,
   documentCache, 
   findEdgesByFromNodeAndEdgeName, 
   findFirstDocumentByFromNodeAndEdgeName, 
} = require('../test_old/docGraph');

const { group } = require('console');

const accountsPublicKey = process.env.TELOS_TESTNET_ACCOUNTS_PUBLIC_KEY;

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

// convert number N to base 4
// then map each digit to digit + 1
function convertToBase4AndAddOne(num, fillLength = 4) {
   const base4Digits = [];
   while (num > 0) {
     base4Digits.push(num % 4 + 1);
     num = Math.floor(num / 4);
   }
   while (base4Digits.length < fillLength) {
     base4Digits.push(1);
   }
   return base4Digits.reverse().join('');
 }
 
 function generateEOSIOAccountNames(N) {
   const accountNames = [];
   const prefix = 'hupetest';
 
   for (let i = 0; i < N; i++) {
     const base4Index = convertToBase4AndAddOne(i);
     const accountName = `${prefix}${base4Index}`;
     accountNames.push(accountName);
   }
 
   return accountNames;
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

// const createMultipleAccounts = async (num, creator = owner) => {
//    let result = []

//    for (let i = 0; i < num; i++) {
//       const member = randomAccountName()

//       await createAccount({
//          account: member,
//          publicKey: newAccountPublicKey,
//          creator: creator
//       })

//       result.push(member)
//    }
//    return result
// }
const createMultipleAccountsWithNames = async ({names, publicKey, creator}) => {
   let result = []

   for (let i = 0; i < names.length; i++) {
      const member = names[i].trim()

      console.log("creating account: " + member)

      await createAccount({
         account: member,
         publicKey: publicKey,
         creator: creator,
         stakes: {
            cpu: '0.5000 TLOS',
            net: '0.5000 TLOS',
            ram: 5000
          },
      })

      console.log("created account: " + member)

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


const updateGraph = async () => {
   await updateDocumentCache()
   await updateEdgesCache()
}

// Now we do some voting in our groups
const getContentGroup = (label, contentArr) => {
   // we expect there to be an array of arrays
   for (arr of contentArr) {
      for (obj of arr) {
         if (obj.label == "content_group_label") {
            if (obj.value[1] == label) {
               return arr
            }
         }
      }
   }
} 
const getValueFromContentGroup = (label, contentGroup) => {
   // a content group is an array of label/value pairs, where value is an array size 2 [type, value]
   for (obj of contentGroup) {
      if (obj.label == label) {
         return obj.value[1] 
      }
   }
} 

// system badges - dao-> badge edges exist

const HEAD_DELEGATE = "headdelegate"
const CHIEF_DELEGATE = "chiefdelegate"

// Badge assignment edge names
const HELD_BY = "heldby";

// Upvote Edge names
const ELECTION_EDGE = "ue.election" // ALL ELECTIONS EVER
const UPCOMING_ELECTION = "ue.upcoming" // CURRENT UPCOMING ELECTION
const ONGOING_ELECTION = "ue.ongoing"
const PREVIOUS_ELECTION = "ue.previous"

const START_ROUND = "ue.startrnd"
const CURRENT_ROUND = "ue.currnd"
const ELECTION_ROUND = "ue.round"
const ELECTION_ROUND_MEMBER = "ue.rd.member"
const ELECTION_GROUP_LINK = "ue.group.lnk"
const GROUP_WINNER = "ue.group.win"

// inline constexpr auto NEXT_ROUND = eosio::name("ue.nextrnd");
// inline constexpr auto ROUND_CANDIDATE = eosio::name("ue.candidate");
// inline constexpr auto ROUND_WINNER = eosio::name("ue.winner");
// inline constexpr auto ELECTION_GROUP = eosio::name("ue.elctngrp");
UP_VOTE_VOTE = "ue.vote"
// inline constexpr auto UPVOTE_GROUP_WINNER = eosio::name("ue.winner");
// inline constexpr auto VOTE = eosio::name("vote"); // ?? 

const getDelegates = (daoObj) => {
   const chiefDelegatesEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, CHIEF_DELEGATE)
   const headDelegateEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, HEAD_DELEGATE)

   if (headDelegateEdges.length != 1) {
      throw "only one head delegate " + headDelegateEdges.length
   }

   return {
      chiefDelegates: chiefDelegatesEdges.map((edge) => edge.to_node ),
      headDelegate: headDelegateEdges[0].to_node
   }
}


const printMessage = (txresult, title = "tx result") => {
   const consoleMessage = txresult.processed.action_traces[0].console;
   console.log(title + ": " + JSON.stringify(consoleMessage, null, 2))
}

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
         2
       ]
     }
   ]
]`)

// a JS Date object for start date
const getUpvoteElectionDoc = (startDate = new Date()) => {
   // create an upvote election
   let time = startDate.toISOString()

   console.log("up elec: " + time)

   // NOTE: The date string is "2023-10-03T03:39:53.250Z" but for some reason
   // eosjs insists of appending a 'Z' so we have to remove the Z first.
   if (time.endsWith("Z")) {
      time = time.slice(0, -1)
   }
   
   return JSON.parse(`[
   [
       { "label": "content_group_label", "value": ["string", "details"] },
       { "label": "upvote_start_date_time", "value": ["time_point", "${time}"] },
       { "label": "upvote_duration", "value": ["int64", 7776000] },
       { "label": "duration", "value": ["int64", 3600] }
   ]
   ]`)
}

const getDao = async () => {
   // query {
   //    getDao(details_daoName_n: "upvotetest1") {
   //      docId
   //      ueUpcoming {
   //        docId
   //      }
   //      ueElection {
   //        docId
   //      }
   //    }
   //  }
}

const getDaoBadges = async () => {
   // query daoBadgesOptions ($daoId: String!,  $first: Int, $offset: Int, $order: BadgeOrder, $filter: BadgeFilter) {
   //    getDao (docId: $daoId) {
   //      docId,
   //      details_daoName_n
   //      badge (first: $first, offset: $offset, order: $order, filter: $filter) {
   //        docId
   //        __typename
   //        ... on Badge {
   //          details_icon_s
   //          details_state_s
   //          details_title_s
   //          details_description_s
   //          details_pegCoefficientX10000_i
   //          details_voiceCoefficientX10000_i
   //          details_rewardCoefficientX10000_i
   //          system_description_s
   //          system_badgeId_i 
   //          system_nodeLabel_s
   //        }
   //      }
   //    }
   //  }
}

const roundOneData = {
   "data": {
     "getDao": {
       "docId": "41191",
       "ueUpcoming": [],
       "ueOngoing": [
         {
           "docId": "41337",
           "ueStartrnd": [
             {
               "docId": "41338"
             }
           ],
           "ueCurrnd": [
             {
               "docId": "41338",
               "ueGroupLnk": [
                 {
                   "docId": "41489",
                   "ueRdMember": [
                     {
                       "docId": "41269",
                       "details_member_n": "hupetest1211"
                     },
                     {
                       "docId": "41303",
                       "details_member_n": "hupetest1312"
                     },
                     {
                       "docId": "41311",
                       "details_member_n": "hupetest1322"
                     },
                     {
                       "docId": "41313",
                       "details_member_n": "hupetest1323"
                     },
                     {
                       "docId": "41317",
                       "details_member_n": "hupetest1331"
                     }
                   ]
                 },
                 {
                   "docId": "41490",
                   "ueRdMember": [
                     {
                       "docId": "41251",
                       "details_member_n": "hupetest1124"
                     },
                     {
                       "docId": "41257",
                       "details_member_n": "hupetest1133"
                     },
                     {
                       "docId": "41265",
                       "details_member_n": "hupetest1143"
                     },
                     {
                       "docId": "41293",
                       "details_member_n": "hupetest1241"
                     },
                     {
                       "docId": "41295",
                       "details_member_n": "hupetest1242"
                     }
                   ]
                 },
                 {
                   "docId": "41491",
                   "ueRdMember": [
                     {
                       "docId": "41271",
                       "details_member_n": "hupetest1212"
                     },
                     {
                       "docId": "41277",
                       "details_member_n": "hupetest1221"
                     },
                     {
                       "docId": "41291",
                       "details_member_n": "hupetest1234"
                     },
                     {
                       "docId": "41335",
                       "details_member_n": "hupetest1412"
                     }
                   ]
                 },
                 {
                   "docId": "41492",
                   "ueRdMember": [
                     {
                       "docId": "41259",
                       "details_member_n": "hupetest1134"
                     },
                     {
                       "docId": "41275",
                       "details_member_n": "hupetest1214"
                     },
                     {
                       "docId": "41327",
                       "details_member_n": "hupetest1342"
                     },
                     {
                       "docId": "41333",
                       "details_member_n": "hupetest1411"
                     }
                   ]
                 },
                 {
                   "docId": "41493",
                   "ueRdMember": [
                     {
                       "docId": "41255",
                       "details_member_n": "hupetest1132"
                     },
                     {
                       "docId": "41261",
                       "details_member_n": "hupetest1141"
                     },
                     {
                       "docId": "41267",
                       "details_member_n": "hupetest1144"
                     },
                     {
                       "docId": "41323",
                       "details_member_n": "hupetest1334"
                     }
                   ]
                 },
                 {
                   "docId": "41494",
                   "ueRdMember": [
                     {
                       "docId": "41243",
                       "details_member_n": "hupetest1114"
                     },
                     {
                       "docId": "41253",
                       "details_member_n": "hupetest1131"
                     },
                     {
                       "docId": "41285",
                       "details_member_n": "hupetest1231"
                     },
                     {
                       "docId": "41331",
                       "details_member_n": "hupetest1344"
                     }
                   ]
                 },
                 {
                   "docId": "41495",
                   "ueRdMember": [
                     {
                       "docId": "41281",
                       "details_member_n": "hupetest1223"
                     },
                     {
                       "docId": "41301",
                       "details_member_n": "hupetest1311"
                     },
                     {
                       "docId": "41315",
                       "details_member_n": "hupetest1324"
                     },
                     {
                       "docId": "41319",
                       "details_member_n": "hupetest1332"
                     }
                   ]
                 },
                 {
                   "docId": "41496",
                   "ueRdMember": [
                     {
                       "docId": "41245",
                       "details_member_n": "hupetest1121"
                     },
                     {
                       "docId": "41249",
                       "details_member_n": "hupetest1123"
                     },
                     {
                       "docId": "41283",
                       "details_member_n": "hupetest1224"
                     },
                     {
                       "docId": "41305",
                       "details_member_n": "hupetest1313"
                     }
                   ]
                 },
                 {
                   "docId": "41497",
                   "ueRdMember": [
                     {
                       "docId": "41237",
                       "details_member_n": "hupetest1111"
                     },
                     {
                       "docId": "41247",
                       "details_member_n": "hupetest1122"
                     },
                     {
                       "docId": "41289",
                       "details_member_n": "hupetest1233"
                     },
                     {
                       "docId": "41325",
                       "details_member_n": "hupetest1341"
                     }
                   ]
                 },
                 {
                   "docId": "41498",
                   "ueRdMember": [
                     {
                       "docId": "41239",
                       "details_member_n": "hupetest1112"
                     },
                     {
                       "docId": "41297",
                       "details_member_n": "hupetest1243"
                     },
                     {
                       "docId": "41299",
                       "details_member_n": "hupetest1244"
                     },
                     {
                       "docId": "41309",
                       "details_member_n": "hupetest1321"
                     }
                   ]
                 },
                 {
                   "docId": "41499",
                   "ueRdMember": [
                     {
                       "docId": "41241",
                       "details_member_n": "hupetest1113"
                     },
                     {
                       "docId": "41307",
                       "details_member_n": "hupetest1314"
                     },
                     {
                       "docId": "41321",
                       "details_member_n": "hupetest1333"
                     },
                     {
                       "docId": "41329",
                       "details_member_n": "hupetest1343"
                     }
                   ]
                 },
                 {
                   "docId": "41500",
                   "ueRdMember": [
                     {
                       "docId": "41263",
                       "details_member_n": "hupetest1142"
                     },
                     {
                       "docId": "41273",
                       "details_member_n": "hupetest1213"
                     },
                     {
                       "docId": "41279",
                       "details_member_n": "hupetest1222"
                     },
                     {
                       "docId": "41287",
                       "details_member_n": "hupetest1232"
                     }
                   ]
                 }
               ]
             }
           ]
         }
       ],
       "ueElection": [
         {
           "docId": "41202"
         },
         {
           "docId": "41337"
         }
       ]
     }
   },
   "extensions": {
     "touched_uids": 205
   }
 }
 const roundTwoData = {
   "data": {
     "getDao": {
       "docId": "41191",
       "ueUpcoming": [],
       "ueOngoing": [
         {
           "docId": "41337",
           "ueStartrnd": [
             {
               "docId": "41338",
               "ueGroupLnk": [
                 {
                   "docId": "41489",
                   "ueGroupWin": [
                     {
                       "docId": "41269"
                     }
                   ]
                 },
                 {
                   "docId": "41490",
                   "ueGroupWin": [
                     {
                       "docId": "41251"
                     }
                   ]
                 },
                 {
                   "docId": "41491",
                   "ueGroupWin": [
                     {
                       "docId": "41271"
                     }
                   ]
                 },
                 {
                   "docId": "41492",
                   "ueGroupWin": [
                     {
                       "docId": "41259"
                     }
                   ]
                 },
                 {
                   "docId": "41493",
                   "ueGroupWin": [
                     {
                       "docId": "41255"
                     }
                   ]
                 },
                 {
                   "docId": "41494",
                   "ueGroupWin": [
                     {
                       "docId": "41243"
                     }
                   ]
                 },
                 {
                   "docId": "41495",
                   "ueGroupWin": [
                     {
                       "docId": "41281"
                     }
                   ]
                 },
                 {
                   "docId": "41496",
                   "ueGroupWin": [
                     {
                       "docId": "41245"
                     }
                   ]
                 },
                 {
                   "docId": "41497",
                   "ueGroupWin": [
                     {
                       "docId": "41237"
                     }
                   ]
                 },
                 {
                   "docId": "41498",
                   "ueGroupWin": [
                     {
                       "docId": "41239"
                     }
                   ]
                 },
                 {
                   "docId": "41499",
                   "ueGroupWin": [
                     {
                       "docId": "41241"
                     }
                   ]
                 },
                 {
                   "docId": "41500",
                   "ueGroupWin": [
                     {
                       "docId": "41263"
                     }
                   ]
                 }
               ]
             }
           ],
           "ueCurrnd": [
             {
               "docId": "41551",
               "ueGroupLnk": [
                 {
                   "docId": "41552",
                   "ueRdMember": [
                     {
                       "docId": "41241",
                       "details_member_n": "hupetest1113"
                     },
                     {
                       "docId": "41251",
                       "details_member_n": "hupetest1124"
                     },
                     {
                       "docId": "41255",
                       "details_member_n": "hupetest1132"
                     },
                     {
                       "docId": "41271",
                       "details_member_n": "hupetest1212"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41553",
                   "ueRdMember": [
                     {
                       "docId": "41243",
                       "details_member_n": "hupetest1114"
                     },
                     {
                       "docId": "41259",
                       "details_member_n": "hupetest1134"
                     },
                     {
                       "docId": "41263",
                       "details_member_n": "hupetest1142"
                     },
                     {
                       "docId": "41269",
                       "details_member_n": "hupetest1211"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41554",
                   "ueRdMember": [
                     {
                       "docId": "41237",
                       "details_member_n": "hupetest1111"
                     },
                     {
                       "docId": "41239",
                       "details_member_n": "hupetest1112"
                     },
                     {
                       "docId": "41245",
                       "details_member_n": "hupetest1121"
                     },
                     {
                       "docId": "41281",
                       "details_member_n": "hupetest1223"
                     }
                   ],
                   "ueGroupWin": []
                 }
               ]
             }
           ]
         }
       ],
       "ueElection": [
         {
           "docId": "41202"
         },
         {
           "docId": "41337"
         }
       ]
     }
   },
   "extensions": {
     "touched_uids": 128
   }
 }

 const roundOneData2 = {
   "data": {
     "getDao": {
       "docId": "41567",
       "ueUpcoming": [],
       "ueOngoing": [
         {
           "docId": "41578",
           "ueStartrnd": [
             {
               "docId": "41579",
               "ueGroupLnk": [
                 {
                   "docId": "41705",
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41706",
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41707",
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41708",
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41709",
                   "ueGroupWin": []
                 }
               ]
             }
           ],
           "ueCurrnd": [
             {
               "docId": "41579",
               "ueGroupLnk": [
                 {
                   "docId": "41705",
                   "ueRdMember": [
                     {
                       "docId": "41293",
                       "details_member_n": "hupetest1241"
                     },
                     {
                       "docId": "41307",
                       "details_member_n": "hupetest1314"
                     },
                     {
                       "docId": "41313",
                       "details_member_n": "hupetest1323"
                     },
                     {
                       "docId": "41329",
                       "details_member_n": "hupetest1343"
                     },
                     {
                       "docId": "41335",
                       "details_member_n": "hupetest1412"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41706",
                   "ueRdMember": [
                     {
                       "docId": "41289",
                       "details_member_n": "hupetest1233"
                     },
                     {
                       "docId": "41303",
                       "details_member_n": "hupetest1312"
                     },
                     {
                       "docId": "41317",
                       "details_member_n": "hupetest1331"
                     },
                     {
                       "docId": "41321",
                       "details_member_n": "hupetest1333"
                     },
                     {
                       "docId": "41331",
                       "details_member_n": "hupetest1344"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41707",
                   "ueRdMember": [
                     {
                       "docId": "41287",
                       "details_member_n": "hupetest1232"
                     },
                     {
                       "docId": "41301",
                       "details_member_n": "hupetest1311"
                     },
                     {
                       "docId": "41311",
                       "details_member_n": "hupetest1322"
                     },
                     {
                       "docId": "41315",
                       "details_member_n": "hupetest1324"
                     },
                     {
                       "docId": "41325",
                       "details_member_n": "hupetest1341"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41708",
                   "ueRdMember": [
                     {
                       "docId": "41297",
                       "details_member_n": "hupetest1243"
                     },
                     {
                       "docId": "41299",
                       "details_member_n": "hupetest1244"
                     },
                     {
                       "docId": "41309",
                       "details_member_n": "hupetest1321"
                     },
                     {
                       "docId": "41327",
                       "details_member_n": "hupetest1342"
                     },
                     {
                       "docId": "41333",
                       "details_member_n": "hupetest1411"
                     }
                   ],
                   "ueGroupWin": []
                 },
                 {
                   "docId": "41709",
                   "ueRdMember": [
                     {
                       "docId": "41291",
                       "details_member_n": "hupetest1234"
                     },
                     {
                       "docId": "41295",
                       "details_member_n": "hupetest1242"
                     },
                     {
                       "docId": "41305",
                       "details_member_n": "hupetest1313"
                     },
                     {
                       "docId": "41319",
                       "details_member_n": "hupetest1332"
                     },
                     {
                       "docId": "41323",
                       "details_member_n": "hupetest1334"
                     }
                   ],
                   "ueGroupWin": []
                 }
               ]
             }
           ]
         }
       ],
       "ueElection": [
         {
           "docId": "41578"
         }
       ]
     }
   },
   "extensions": {
     "touched_uids": 128
   }
 }

const autoAddDelegateBadge = async ({
   daoId, 
   member,
   delegateBadgeId,
   startPeriodDocId,
}) => {
   console.log("autoAddDelegateBadge: " + member + " contract " + daoContract)
   const contract = await eos.contract(daoContract)

   // Give the members delegate badges
   const badgeProposalData = badgeAssignmentPropData({
      assignee: member,
      badgeTitle: "Delegate Badge",
      badgeId: delegateBadgeId,
      startPeriodId: startPeriodDocId,
   })

   await contract.propose(
      daoId,
      member,
      "assignbadge",
      badgeProposalData,
      true,
      { authorization: `${member}@active` }
   )

}

const startElection = async ({
   electionId, 
}) => {
   console.log("startElection: " + electionId)
   const contract = await eos.contract(daoContract)

   // Give the members delegate badges
   // ACTION updateupvelc(uint64_t election_id, bool reschedule, bool force);

   const res = await contract.updateupvelc(
      electionId,
      false,
      true,
      { authorization: `${daoContract}@active` }
   )

   printMessage(res, "upvote election result ")

}


const autoEnrollMember = async ({daoId, member, daoOwnerAccount}) => {
   //console.log("enrolling: " + member + " contract " + daoContract)
   const contract = await eos.contract(daoContract)

   await contract.autoenroll(daoId, daoOwnerAccount, member, { authorization: `${daoOwnerAccount}@active` });
}

const addAccounts = async ({
   daoContractName, 
   numAccounts, 
   pubKey, 
   creator
}) => {
   let result = []

   for (let i = 0; i < numAccounts; i++) {
      const member = randomAccountName()

      await createAccount({
         account: member,
         publicKey: pubKey,
         creator: creator
      })

      result.push(member)
   }
   const contract = await eos.contract(daoContractName)


   for (let member of members) {
      await autoAddDelegateBadge(member)
   }






   return result
}

program
  .command('create_accounts <number>')
  .description('Create N accounts')
  .action(async (number) => {

      const names = generateEOSIOAccountNames(number)
      console.log("Accounts: " + JSON.stringify(names, null, 2))

      const creatorAccountName = "nikolaus223t"

      console.log("creating accounts with " + creatorAccountName + " and key " + accountsPublicKey)
      
      const res = await createMultipleAccountsWithNames({
         names: names, 
         publicKey: accountsPublicKey,
         creator: creatorAccountName, 
      })
    

   })


   program
   .command('onboard_accounts <onboarder> <daoId>')
   .description('onboard 50 accounts')
   .action(async (onboarder, daoId) => {
 
       const names = generateEOSIOAccountNames(50)
       console.log("Accounts: " + JSON.stringify(names, null, 2))
  
       console.log("onboarding accounts " + onboarder + " to DAO " + daoId)
       
       for (member of names) {
         console.log("onboarding " + member +" to " + daoId + " with " + onboarder)
         const res = await autoEnrollMember({
            daoId: daoId,
            member: member,
            daoOwnerAccount: onboarder,
          })
   
       }
     
 
    })

   program
   .command('delegate_badge <daoId> <num>')
   .description('Create N accounts')
   .action(async (daoId, num = 50) => {

      const names = generateEOSIOAccountNames(num)
      console.log("Accounts: " + JSON.stringify(names, null, 2))

      //const creatorAccountName = "nikolaus223t"
      //const daoId = 4119
      const delegateBadgeId = 41204
      const electionId = 41337
   //   Periods...
   //   {
   //    "docId": "30697",
   //    "details_startTime_t": "2023-09-30T18:08:00Z"
   //  },
   //  {
   //    "docId": "30698",
   //    "details_startTime_t": "2023-10-07T18:08:00Z"
   //  },
   //  {
   //    "docId": "30699",
   //    "details_startTime_t": "2023-10-14T18:08:00Z"
   //  },
   const startPeriodId = 30698

      console.log("delegate badge for DAO " + daoId)
      
      for (member of names) {
         if (member < "hupetest1232") {
            console.log("skipping " + member)
            continue
         }
         console.log("delegate badge for " + member +" to " + daoId)
         await autoAddDelegateBadge({
            daoId: daoId,
            member: member,
            delegateBadgeId: delegateBadgeId,
            startPeriodDocId: startPeriodId
         });
      }
})

program
.command('start_upvote <electionId>')
.description('Create N accounts')
.action(async (electionId) => {
   console.log("starting election " + electionId)
   await startElection({
      electionId: electionId
   })
   
})

program
.command('vote')
.description('Vote!')
.action(async () => {

   // ROUND 1
   // const round = roundOneData["data"]["getDao"]["ueOngoing"][0]["ueCurrnd"][0]

   // Round 2
   // const round = roundTwoData["data"]["getDao"]["ueOngoing"][0]["ueCurrnd"][0]

   // DAO2 ROUND 1
   const round = roundOneData2["data"]["getDao"]["ueOngoing"][0]["ueCurrnd"][0]
   
   const roundId = round["docId"]
   const roundGroups = round["ueGroupLnk"]
   console.log("roundGroups " + roundGroups.length)
   const contract = await eos.contract(daoContract)

   let total = 0
   for (const rGroup of roundGroups) {
      const groupId = rGroup["docId"]
      const roundGroupsMembers = rGroup["ueRdMember"]
      const winnerId = roundGroupsMembers[0]["docId"] // winner is member on index 0
      for (const member of roundGroupsMembers) {

         const memberId = member["docId"]
         const memberName = member["details_member_n"]
   
         console.log((total++) + " vote in round " + roundId + " group " + groupId + " for member " +winnerId + " from member " + memberName)

         const vote = async ({roundId, groupId, membername, votingForId}) => {
            // ACTION castupvote(uint64_t round_id, uint64_t group_id, name voter, uint64_t voted_id);
            const voteRes = await contract.castupvote(roundId, groupId, membername, votingForId, { authorization: `${membername}@active` })
            printMessage(voteRes, " vote res ")
         }
         await vote({
            roundId: roundId,
            groupId: groupId,
            membername: memberName,
            votingForId: winnerId,
         })
      
      }
   
   }
      
})


 
   
program
  .command('restore <contract>')
  .description('Restore tables to contract')
  .action(async contract => {
    
  })

program.parse(process.argv)

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
  program.help();
}



