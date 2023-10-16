const { describe } = require('riteway')
const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('../scripts/helper')
const getCreateDaoData = require("./helpers/getCreateDaoData")

const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names
var crypto = require('crypto');
const { create } = require('domain');
const createAccount = require('../scripts/createAccount');
const { title } = require('process');
const { 
   updateDocumentCache, 
   updateEdgesCache, 
   edgesCache,
   documentCache, 
   findEdgesByFromNodeAndEdgeName, 
   findFirstDocumentByFromNodeAndEdgeName, 
} = require('./docGraph');

const { group } = require('console');
const getUpvoteElectionDoc = require('./helpers/getUpvoteElectionDoc');
const getBadgeAssignmentPropData = require('./helpers/getBadgeAssignmentPropData');

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

/// prints the message from a transaction result object
/// we get this as a return value any time we execute a transaction
const printMessage = (txresult, title = "tx result") => {
   const consoleMessage = txresult.processed.action_traces[0].console;
   console.log(title + ": " + JSON.stringify(consoleMessage, null, 2))
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

const BADGE_NAME = "badge"

NEXT_ROUND = "ue.nextrnd"
// inline constexpr auto ROUND_CANDIDATE = eosio::name("ue.candidate");
// inline constexpr auto ROUND_WINNER = eosio::name("ue.winner");
// inline constexpr auto ELECTION_GROUP = eosio::name("ue.elctngrp");
UP_VOTE_VOTE = "ue.vote"
// inline constexpr auto UPVOTE_GROUP_WINNER = eosio::name("ue.winner");
// inline constexpr auto VOTE = eosio::name("vote"); // ?? 

const getDelegates = (daoObj, doOneHeadDelegateCheck = true) => {
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


////////////////////////////////////////////////////////////////////////
/////////// Main unit test
////////////////////////////////////////////////////////////////////////

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
   // console.log("DAO params " + JSON.stringify(daoParams, null, 2))

   /// =============================================================================
   /// Create a new DAO
   /// =============================================================================

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

   const checkCurrentRound = (title, electionDoc) => {
      const currentRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
      assert({
         given: title + ' groups vote update',
         should: 'only 1 current round',
         actual: currentRoundEdges.length,
         expected: 1,
      })
      return findFirstDocumentByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
   }
   
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

   const members = await createMultipleAccounts(37)
   console.log("created members: " + members.length)


   console.log("create upvote data")
   let data = getUpvoteElectionDoc()

   /// =============================================================================
   /// Create the 1st election (of 2)
   /// =============================================================================

   // ACTION createupvelc(uint64_t dao_id, ContentGroups& election_config)
   console.log("create upvote election")
   const createTx = await contract.createupvelc(daoObj.id, data, { authorization: `${daoOwnerAccount}@active` })
   printMessage(createTx, "upvote election ")

   const docs3 = await getLastDocuments(20)
   const electionDocType = "upvt.electn"
   const upElecDoc = docs3.find(item => JSON.stringify(item.content_groups).indexOf(electionDocType) != -1);
   console.log("election ID: " + upElecDoc.id)
   sleep(1000)

   // read all data into caches
   await updateGraph()

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

   // console.log("startRoundEdge " + JSON.stringify(startRoundEdge, null, 2))
   // console.log("electionRoundEdge " + JSON.stringify(electionRoundEdge, null, 2))

   const startRound = documentCache[startRoundEdge.to_node]

   // console.log("start round " + JSON.stringify(startRound))
   // console.log("all edges " + electionDoc.id + " " + JSON.stringify(edgesCache, null, 2))
   // console.log("all docs " + electionDoc.id + " " + JSON.stringify(documentCache, null, 2))

   // ACTION uesubmitseed(uint64_t dao_id, eosio::checksum256 seed, name account);
   const blockChainHeaderHash = await getBitcoinBlockHeader();
   console.log("latest block header: " + blockChainHeaderHash)

   const seedres = await contract.uesubmitseed(daoObj.id, blockChainHeaderHash, daoOwnerAccount, { authorization: `${daoOwnerAccount}@active` })
   //printMessage(seedres, "seedres ")

   await updateGraph()

   const electionDoc2 = documentCache[electionEdge.to_node]
   // console.log("election doc " + JSON.stringify(electionDoc2, null, 2))

   assert({
      given: 'seed was set correctly',
      should: 'has election round',
      actual: JSON.stringify(electionDoc2, null, 2).indexOf(blockChainHeaderHash) != -1,
      expected: true,
   })

   const autoAddDelegateBadge = async (member) => {
      await contract.autoenroll(daoObj.id, daoOwnerAccount, member, { authorization: `${daoOwnerAccount}@active` });
      //console.log("enrolled member: " + member)

      // Give the members delegate badges
      const badgeProposalData = getBadgeAssignmentPropData({
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
      // console.log("added delegate badge for " + member)

   }
   // ACTION autoenroll(uint64_t id, const name& enroller, const name& member);
   for (let member of members) {
      await autoAddDelegateBadge(member)
   }

   await sleep(1000)

   await updateGraph()


   /// =============================================================================
   /// Start first Election
   /// =============================================================================
   // ACTION updateupvelc(uint64_t election_id, bool reschedule);
   console.log("Start election")
   const updateVote = await contract.updateupvelc(upElecDoc.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote, "update result")

   await sleep(1000)

   await updateGraph() 

   const getElectionGroups = (round) => {
      const edges = findEdgesByFromNodeAndEdgeName(round.id, ELECTION_GROUP_LINK)
      const groups = edges.map((edge) => documentCache[edge.to_node]) 

      for (const group of groups) {
         const memberEdges = findEdgesByFromNodeAndEdgeName(group.id, ELECTION_ROUND_MEMBER)
         const members = memberEdges.map((edge) => documentCache[edge.to_node])

         const voteEdges = findEdgesByFromNodeAndEdgeName(group.id, UP_VOTE_VOTE)
         const votes = voteEdges.map((edge) => documentCache[edge.to_node])

         group["gen_members"] = members   
         group["gen_votes"] = votes
         group["gen_winner"] = getValueFromContentGroup("winner", getContentGroup("details", group.content_groups))
         group["winner_edge"] = findEdgesByFromNodeAndEdgeName(group.id, GROUP_WINNER)

         if (group.gen_winner != -1) {
            assert({
               given: 'winner edge is winner',
               should: 'edge is defined',
               actual: group.winner_edge[0].to_node == group.gen_winner,
               expected: true,
            })
         } else {
            assert({
               given: 'no winner',
               should: 'winner edge is undefined',
               actual: group.winner_edge.length == 0,
               expected: true,
            })

         }
      }
      return groups;
   }
   // the election
   const election2 = documentCache[electionDoc.id]
   const startRound2 = documentCache[startRound.id]
   const currentRound1 = checkCurrentRound("E1R1 ", electionDoc)

   // console.log("election: " + JSON.stringify(election2, null, 2))
   // console.log("start round: " + JSON.stringify(startRound2, null, 2))

   let groups = getElectionGroups(startRound2)
   // console.log("start round groups: " + JSON.stringify(groups, null, 2))

   let allMembers = []

   for (g of groups) {
      const members = g.gen_members
      const memberIds = members.map((m) => m.id)
      
      console.log(" group " + g.id + "(" + memberIds.length + ")" + ": " + JSON.stringify(memberIds))

      allMembers = [...allMembers, ...memberIds]
   }

   console.log("members: " + allMembers.length)
   
   assert({
      given: 'start round started',
      should: 'has election groups',
      actual: groups.length > 0,
      expected: true,
   })

   assert({
      given: 'election started',
      should: 'current round id is start round',
      actual: currentRound1.id,
      expected: startRound2.id,
   })


   for (g of groups) {
      assert({
         given: 'groups created',
         should: 'have members',
         actual: g.gen_members.length > 0,
         expected: true,
      })
   }

   const getMemberName = (memberId) => {
      const contentGroups = documentCache[memberId]["content_groups"]
      const contentGroup = getContentGroup("details", contentGroups)
      const memberName = getValueFromContentGroup("member", contentGroup)
      return memberName
   }

   const vote = async ({roundId, groupId, membername, votingForId}) => {
      // ACTION castupvote(uint64_t round_id, uint64_t group_id, name voter, uint64_t voted_id);
      const voteRes = await contract.castupvote(roundId, groupId, membername, votingForId, { authorization: `${membername}@active` })

   }

   /// =============================================================================
   /// Vote in election
   /// =============================================================================
   const winners = {}
   for (const group of groups) {
      const members = group.gen_members
      const memberIds = members.map((m) => m.id)
      console.log("voting in round " +startRound.id+ " group: " + group.id)
      const winner = memberIds[1]
      for (const memberId of memberIds) {
         const voter = getMemberName(memberId)
         await vote({
            roundId: startRound2.id,
            groupId: group.id,
            membername: voter,
            votingForId: winner
         })

      }
      winners[group.id] = winner
   }

   let voteInWrongGroup = false;
   try {
      await vote({
         roundId: startRound2.id,
         group: groups[1].id,          // vote in group 1
         membername: getMemberName(groups[0].gen_members[0].id), // by member 0 in group 0
         votingForId: groups[1].gen_members[0] // in group 1
      })
      voteInWrongGroup = true
   } catch (err) {
      console.log("expected error")
   }
   let voteForWrongGroup = false;
   try {
      await vote({
         roundId: startRound2.id,
         group: groups[0].id,          // vote in group 0
         membername: getMemberName(groups[0].gen_members[0].id), // by member 0 in group 0
         votingForId: groups[1].gen_members[0] // in group 1
      })
      voteForWrongGroup = true
   } catch (err) {
      console.log("expected error")
   }

   await updateGraph()

   // update groups data
   groups = getElectionGroups(startRound2)

   //console.log("after vote groups: " + JSON.stringify(groups, null, 2))

   const allWinners = []


   for (const group of groups) {
      console.log(group.id + " (" + group.gen_members.length + "): " + JSON.stringify(group.gen_members.map(m => m.id)))
      console.log(group.id + " winner: " + group.gen_winner)

      assert({
         given: 'group voting winner',
         should: 'be member at index 1',
         actual: group.gen_winner,
         expected: group.gen_members[1].id,
      })

      const groupWinnerEdge = findEdgesByFromNodeAndEdgeName(group.id, GROUP_WINNER)[0]
      assert({
         given: 'group voting winner',
         should: 'winner edge exists',
         actual: groupWinnerEdge.to_node,
         expected: group.gen_members[1].id,
      })


      allWinners.push(groups.gen_winner)
   }

   console.log("Next round 1 -> 2")

   /// =============================================================================
   /// Update election
   /// =============================================================================
   const updateVote2 = await contract.updateupvelc(upElecDoc.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote2, "update 2 result")
   await sleep(1000)
   await updateGraph() 

   const badgesDao = findEdgesByFromNodeAndEdgeName(daoObj.id, BADGE_NAME)
   // console.log("badgesDao: " + JSON.stringify(badgesDao, null, 2))


   const electionEdge3 = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE)[0]
   const electionDoc3 = documentCache[electionEdge.to_node]

   // console.log("electionDoc3: " + JSON.stringify(electionDoc3, null, 2))

   const electionEdge4 = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE)
   // console.log("electionEdge4 [list] " + JSON.stringify(electionEdge4, null, 2))

   // TODO assert: ongoing election should be empty
   const ongoingElectionEdge4 = findEdgesByFromNodeAndEdgeName(daoObj.id, ONGOING_ELECTION)
   // console.log("ongoingElectionEdge4 " + JSON.stringify(ongoingElectionEdge4, null, 2))

   // TODO assert: prev election should be set
   const previousElectionEdge4 = findEdgesByFromNodeAndEdgeName(daoObj.id, PREVIOUS_ELECTION)
   // console.log("previousElectionEdge4 " + JSON.stringify(previousElectionEdge4, null, 2))

   assert({
      given: 'election ended',
      should: 'prev edge defined',
      actual: previousElectionEdge4.length,
      expected: 1,
   })

   // Confirm the delegate badges have been set to the winners
   // TODO Assert
   // EDGE exists from DAO ->  Member with NAME (badge link)
   const chiefDelegatesEdges4 = findEdgesByFromNodeAndEdgeName(daoObj.id, CHIEF_DELEGATE)
   // console.log("chiefDelegatesEdges4 (members): " + JSON.stringify(chiefDelegatesEdges4, null, 2))

   assert({
      given: 'election ended - CDs',
      should: '6 chief delegates are defined',
      actual: chiefDelegatesEdges4.length,
      expected: 6,
   })


   const headDelegateEdges4 = findEdgesByFromNodeAndEdgeName(daoObj.id, HEAD_DELEGATE)
   // console.log("headDelegateEdges4 " + JSON.stringify(headDelegateEdges4, null, 2))

   assert({
      given: 'election ended - head delegate',
      should: '1 head delegates is defined',
      actual: headDelegateEdges4.length,
      expected: 1,
   })

   

   const electionDoc4 = documentCache[previousElectionEdge4[0].to_node]
   // console.log("electionDoc4 (prev) " + JSON.stringify(electionDoc4, null, 2))
   const electionFinished = JSON.stringify(electionDoc4).indexOf("finished") != -1
   
   assert({
      given: 'election was finished = prev election',
      should: 'previous election edge set to ' + electionDoc.id,
      actual: electionDoc4.id,
      expected: electionDoc.id,
   })

   assert({
      given: 'election was finished',
      should: 'have finished flag set',
      actual: electionFinished,
      expected: true,
   })


   // TODO: Not sure we need to assert these? Probably..
   const startRoundEdge4 = findEdgesByFromNodeAndEdgeName(electionDoc.id, START_ROUND)[0]
   // console.log("startRoundEdge4 " + JSON.stringify(startRoundEdge4, null, 2))
   const startRound4 = documentCache[startRoundEdge4.to_node]

   // this is defined - is it used anywhere in the code?
   const electionRoundEdges4 = findEdgesByFromNodeAndEdgeName(electionDoc.id, ELECTION_ROUND)
   // console.log("electionRoundEdges4 " + JSON.stringify(electionRoundEdges4, null, 2))
   let max = -1
   let lastRoundEdge = undefined
   for (ere4 of electionRoundEdges4) {
      if (ere4.to_node > max) {
         max = ere4.to_node
         lastRoundEdge = ere4
      }
   }
   const lastRound = documentCache[lastRoundEdge.to_node]
   const lastGroups = getElectionGroups(lastRound)
   // console.log("winners group" + JSON.stringify(lastGroups, null, 2))

   for (const group of lastGroups) {
      console.log(group.id + " (" + group.gen_members.length + "): " + JSON.stringify(group.gen_members.map(m => m.id)))
      console.log(group.id + " winner: " + group.gen_winner)
   }


   const currentRoundEdge4 = findEdgesByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
   // console.log("currentRoundEdge4 list " + JSON.stringify(currentRoundEdge4, null, 2))

   assert({
      given: 'election was finished',
      should: 'last round is current',
      actual: currentRoundEdge4.length,
      expected: 1,
   })

   // TODO figure out if next round is set correctly at some point
   // const startRoundEdge41 = findEdgesByFromNodeAndEdgeName(electionDoc.id, START_ROUND)
   // const nextRound1 = findEdgesByFromNodeAndEdgeName(startRoundEdge41.to_node, NEXT_ROUND)
   // const nextRound2 = findEdgesByFromNodeAndEdgeName(nextRound1.to_node, NEXT_ROUND)

   // assert({
   //    given: 'election was finished',
   //    should: 'last round is current',
   //    actual: currentRoundEdge4[0].to_node,
   //    expected: nextRound1.to_node,
   // })
   // assert({
   //    given: 'election was finished',
   //    should: 'last round is last',
   //    actual: nextRound2,
   //    expected: undefined,
   // })


   // Note: if 11 or fewer members are in the election, it ends. It can end with 11 CDs. 

   assert({
      given: 'round 2',
      should: 'start round is the same',
      actual: startRound4.id,
      expected: startRound2.id,
   })

   assert({
      given: 'vote in wrong group',
      should: 'throw error',
      actual: voteInWrongGroup,
      expected: false,
   })

   assert({
      given: 'vote for member in wrong group',
      should: 'throw error',
      actual:  voteForWrongGroup,
      expected: false,
   })

   
   /// =============================================================================
   /// Create the 2nd election
   /// =============================================================================

   console.log("VIDEO LINK")
   const theVideoLink = "https://somevideolink.com/thisisthelink/etc"
   const videoGroup = lastGroups[0]
   const videoMemberObj = videoGroup.gen_members[0]
   const videoMember = getMemberName(videoMemberObj.id)
   const videoRes = await contract.upvotevideo(videoGroup.id, videoMember, theVideoLink, { authorization: `${videoMember}@active` })
   printMessage(videoRes, "videoRes")
   await updateGraph()
   const videoGroupDoc = documentCache[videoGroup.id]
   const video = getValueFromContentGroup("videolink", getContentGroup("details", videoGroupDoc.content_groups))

   assert({
      given: 'upload video',
      should: 'video is added to group',
      actual:  video,
      expected: theVideoLink,
   })


   // Straight into the next election!

   const electionChiefDelegates = getDelegates(daoObj)
   console.log("electionChiefDelegates" + JSON.stringify(electionChiefDelegates, null, 2))

   console.log("============== Election 2 ==================")

   /// =============================================================================
   /// Create the 2nd election
   /// =============================================================================

   console.log("create upvote election 2")
   let data2 = getUpvoteElectionDoc()
   const createTx2 = await contract.createupvelc(daoObj.id, data2, { authorization: `${daoOwnerAccount}@active` })
   printMessage(createTx2, "upvote election 2 ")

   /// =============================================================================
   /// Sign up more members to make it 50 members, apply for badges for all of them
   /// =============================================================================

   // add more members so we have 50 members 
   const additionalSize = 50 - members.length
   const additionalMembers = await createMultipleAccounts(additionalSize)

   // add them to the list and sign them all up as delegates
   // Normally members delegate badges expire before the next election, then they all have 
   // to sign up again - which is as intended
   // But because we shortcut the election, the existing badges haven't exipred yet.
   for (const member of additionalMembers) {
      members.push(member)
      await autoAddDelegateBadge(member)
   }

   console.log("2nd election " + members.length + " members.")

   /// =============================================================================
   /// Set the Seed
   /// =============================================================================

   const btcHeader2 = await getBitcoinBlockHeader();
   console.log("btcHeader2: " + btcHeader2)
   const seedresB = await contract.uesubmitseed(daoObj.id, btcHeader2, daoOwnerAccount, { authorization: `${daoOwnerAccount}@active` })
   printMessage(seedres, "seedres ")
   await updateGraph() 
   const electionEdgeB = findEdgesByFromNodeAndEdgeName(daoObj.id, UPCOMING_ELECTION)[0]
   const electionDocB = documentCache[electionEdgeB.to_node]


   console.log("election doc " + electionDocB.id + " old election doc: " + electionDoc.id)
   assert({
      given: 'a mew election was created',
      should: 'new document id',
      actual:  electionDocB.id != electionDoc.id,
      expected: true,
   })

   assert({
      given: 'seed was set ',
      should: 'election has seed set',
      actual: JSON.stringify(electionDocB, null, 2).indexOf(btcHeader2) != -1,
      expected: true,
   })

   /// =============================================================================
   /// Start round 1 of the 2nd election
   /// =============================================================================

   const updateVote3 = await contract.updateupvelc(electionDocB.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote3, "updateVote3 result")
   await sleep(1000)
   await updateGraph() 

   const ongoingElectionEdgeB = findEdgesByFromNodeAndEdgeName(daoObj.id, ONGOING_ELECTION)[0]
   const onegoingElectionDocB = documentCache[ongoingElectionEdgeB.to_node]

   assert({
      given: 'a mew election was started',
      should: 'ongoing election doc is current election doc',
      actual:  electionDocB.id == onegoingElectionDocB.id,
      expected: true,
   })

   /// == verify rounds
   const currentRoundDoc = checkCurrentRound("E2R1 ", electionDocB)
   console.log("B current round " + currentRoundDoc.id)
   let groupsRound1 = getElectionGroups(currentRoundDoc)

   // console.log("E2 start round groups: " + JSON.stringify(groupsRound1, null, 2))

   let allMembersElection2 = []

   for (g of groupsRound1) {
      const members = g.gen_members
      const memberIds = members.map((m) => m.id)
      
      console.log(" group " + g.id + "(" + memberIds.length + ")" + ": " + JSON.stringify(memberIds))

      allMembersElection2 = [...allMembersElection2, ...memberIds]
   }

   console.log("E2 members: " + allMembersElection2.length)
   
   assert({
      given: 'E2 start round started',
      should: 'has election groups',
      actual: groupsRound1.length > 0,
      expected: true,
   })
   assert({
      given: 'E2 start round started',
      should: 'all members are in groups',
      actual: allMembersElection2.length == members.length,
      expected: true,
   })

   for (g of groupsRound1) {
      assert({
         given: 'E2 groups created',
         should: 'have members',
         actual: g.gen_members.length > 0,
         expected: true,
      })
   }

   /// =============================================================================
   /// Vote in round 1 of the second election - we vote for candidate at index 2
   /// =============================================================================
   const winnersB = {}

   for (const group of groupsRound1) {
      const members = group.gen_members
      const memberIds = members.map((m) => m.id)
      console.log("E2R1: round " +startRound.id+ " group: " + group.id)
      const winner = memberIds[2]
      for (const memberId of memberIds) {
         const voter = getMemberName(memberId)
         await vote({
            roundId: currentRoundDoc.id,
            groupId: group.id,
            membername: voter,
            votingForId: winner
         })

      }
      winnersB[group.id] = winner
   }

   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)

   //console.log("after vote groups: " + JSON.stringify(groupsRound1, null, 2))

   const allWinnersB = []

   const uniquenessMap = {}

   for (const group of groupsRound1) {
      console.log(group.id + " (" + group.gen_members.length + "): " + JSON.stringify(group.gen_members.map(m => m.id)))
      console.log(group.id + " winner: " + group.gen_winner)

      assert({
         given: 'group voting winner',
         should: 'be member at index 2',
         actual: group.gen_winner,
         expected: group.gen_members[2].id,
      })
      allWinnersB.push(groups.gen_winner)

      assert({
         given: 'group winners',
         should: 'are unique',
         actual: uniquenessMap[group.gen_winner] == undefined,
         expected: true,
      })

      uniquenessMap[group.gen_winner] = group.gen_winner
   }
   assert({
      given: 'Round of 50 members voted',
      should: '12 winners',
      actual: allWinnersB.length,
      expected: 12,
   })

   // change vote in a group, see if it works
   let group0 = groupsRound1[0]
   console.log("group 0" + JSON.stringify(group0, null, 2))
   let members0 = group0.gen_members
   let memberIds0 = members0.map((m) => m.id)
   console.log("members0: group of " +memberIds0.length)
   const prevWinner = memberIds0[2]

   // 1 - winner changes their mind, votes for someone else -> no winner      const voter = getMemberName(memberId)
   const prevWinnerName = getMemberName(prevWinner)
   await vote({
      roundId: currentRoundDoc.id,
      groupId: group0.id,
      membername: prevWinnerName,
      votingForId: memberIds0[0]
   })
   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)
   group0 = groupsRound1[0]
   console.log("gen winner: " + group0.gen_winner)
   assert({
      given: 'Winner didnt vote for themselves',
      should: 'no winner',
      actual: group0.winner_edge.length,
      expected: 0,
   })

   // vote for himself again
   await vote({
      roundId: currentRoundDoc.id,
      groupId: group0.id,
      membername: prevWinnerName,
      votingForId: prevWinner
   })
   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)
   group0 = groupsRound1[0]

   assert({
      given: 'Winner voted for themselves again',
      should: 'have winner',
      actual: group0.winner_edge[0].to_node,
      expected: prevWinner,
   })

   // now vote for someone else - group of 4
   members0 = group0.gen_members
   memberIds0 = members0.map((m) => m.id)
   await vote({
      roundId: currentRoundDoc.id,
      groupId: group0.id,
      membername: getMemberName(memberIds0[0]),
      votingForId: memberIds0[3]
   })
   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)
   group0 = groupsRound1[0]

   assert({
      given: 'A member changed their vote',
      should: '3 votes out of 4 - still the same winner',
      actual: group0.gen_winner,
      expected: prevWinner,
   })

   await vote({
      roundId: currentRoundDoc.id,
      groupId: group0.id,
      membername: getMemberName(memberIds0[3]),
      votingForId: memberIds0[3]
   })
   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)
   group0 = groupsRound1[0]

   assert({
      given: '2 members changed their vote',
      should: 'no winner - its 2 - 2',
      actual: group0.gen_winner,
      expected: -1,
   })

   // change vote back, proceed as normal with group winners in all groups
   await vote({
      roundId: currentRoundDoc.id,
      groupId: group0.id,
      membername: getMemberName(memberIds0[0]),
      votingForId: prevWinner
   })
   await updateGraph()
   groupsRound1 = getElectionGroups(currentRoundDoc)
   group0 = groupsRound1[0]

   /// =============================================================================
   /// Push to Round 2 of the second election
   /// =============================================================================

   console.log("E2R1 Next round 1 -> 2")
   const updateVote4 = await contract.updateupvelc(electionDocB.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote4, "E2R1 update 2 result")
   await sleep(1000)
   await updateGraph() 

   const electionDocsSize = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE).length
   const ongoingElectionEdge5 = findEdgesByFromNodeAndEdgeName(daoObj.id, ONGOING_ELECTION)
   const ongoingElectionDoc5 = findFirstDocumentByFromNodeAndEdgeName(daoObj.id, ONGOING_ELECTION)

   const currentRound5 = checkCurrentRound("E2R2", ongoingElectionDoc5)
   //console.log("current round 5: " + JSON.stringify(currentRound5, null, 2))

   let groupsRound2 = getElectionGroups(currentRound5)

   for (g of groupsRound2) {
      const members = g.gen_members
      const memberIds = members.map((m) => m.id)
      
      console.log("E2R2 group " + g.id + "(" + memberIds.length + ")" + ": " + JSON.stringify(memberIds))
      assert({
         given: 'E2R2 groups created',
         should: 'have 4 members',
         actual: g.gen_members.length,
         expected: 4,
      })

   }

   assert({
      given: 'E2R2 groups created',
      should: '3 groups expected for 12 members',
      actual: groupsRound2.length,
      expected: 3,
   })

   assert({
      given: 'E2R2 groups created',
      should: '1 current round',
      actual: groupsRound2.length,
      expected: 3,
   })



   // assert electionDocsSize == 2
   assert({
      given: '2nd elections ',
      should: 'number of elections == 2',
      actual: electionDocsSize,
      expected: 2,
   })

   // assert ongoingElectionEdgeSize == 1
   assert({
      given: '2nd elections ',
      should: 'number of ongoing elections == 1',
      actual: ongoingElectionEdge5.length,
      expected: 1,
   })

   /// =============================================================================
   /// Vote in round 2 of the second election - we vote for candidate at index 3
   /// =============================================================================
   const winnersB2 = {}

   for (const group of groupsRound2) {
      const members = group.gen_members
      const memberIds = members.map((m) => m.id)
      console.log("E2R2: round " +currentRound5.id+ " group: " + group.id)
      const winner = memberIds[3]
      for (const memberId of memberIds) {
         const voter = getMemberName(memberId)
         await vote({
            roundId: currentRound5.id,
            groupId: group.id,
            membername: voter,
            votingForId: winner
         })

      }
      winnersB2[group.id] = winner
   }

   await updateGraph()
   groupsRound2 = getElectionGroups(currentRound5)

   //console.log("after vote groups: " + JSON.stringify(groupsRound1, null, 2))

   const allWinnersB2 = []

   const uniquenessMap2 = {}

   for (const group of groupsRound2) {
      console.log(group.id + " (" + group.gen_members.length + "): " + JSON.stringify(group.gen_members.map(m => m.id)))
      console.log(group.id + " winner: " + group.gen_winner)

      assert({
         given: 'group voting winner',
         should: 'be member at index 3',
         actual: group.gen_winner,
         expected: group.gen_members[3].id,
      })
      allWinnersB2.push(groups.gen_winner)

      assert({
         given: 'group winners',
         should: 'are unique',
         actual: uniquenessMap2[group.gen_winner] == undefined,
         expected: true,
      })
      
      uniquenessMap2[group.gen_winner] = group.gen_winner
   }
   assert({
      given: 'Round of 12 members voted',
      should: '3 winners',
      actual: allWinnersB2.length,
      expected: 3,
   })

   /// =============================================================================
   /// Push to Round 3 of the second election - last round
   /// =============================================================================

   console.log("E2R2 Next round 2 -> 3")
   const updateVote5 = await contract.updateupvelc(electionDocB.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote5, "E2R3 update 2 result")
   await sleep(1000)
   await updateGraph() 

   const finishedElectionEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, PREVIOUS_ELECTION)
   const finishedElection = documentCache[electionDocB.id]


   assert({
      given: 'finished 2nd election',
      should: 'prev election is an old ongoing election',
      actual: finishedElectionEdges.map(e => e.to_node).indexOf(ongoingElectionDoc5.id) != -1,
      expected: true,
   })
   

   assert({
      given: 'election was finished',
      should: 'have finished flag set',
      actual: JSON.stringify(finishedElection).indexOf("finished") != -1,
      expected: true,
   })
   // await updateGraph() 

      /// we cannot do this test on the second election round because due to testing we still have other CDs and HD flying around
   // const { chiefDelegates, headDelegate } = getDelegates(daoObj, true)


   // Advance to the next round

   // Check winners each round until last round



})

describe('edge case - no delegates', async assert => {

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

   /// =============================================================================
   /// Create a new DAO
   /// =============================================================================

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

   const checkCurrentRound = (title, electionDoc) => {
      const currentRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
      assert({
         given: title + ' groups vote update',
         should: 'only 1 current round',
         actual: currentRoundEdges.length,
         expected: 1,
      })
      return findFirstDocumentByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
   }
   
   const daoObj = await getDaoEntry(newDaoName)
   console.log("DAO id: " + daoObj.id + " Name: " + newDaoName)

   console.log("create upvote data")
   let data = getUpvoteElectionDoc()

   /// =============================================================================
   /// Create the 1st election (of 2)
   /// =============================================================================

   // ACTION createupvelc(uint64_t dao_id, ContentGroups& election_config)
   console.log("create upvote election")
   const createTx = await contract.createupvelc(daoObj.id, data, { authorization: `${daoOwnerAccount}@active` })
   printMessage(createTx, "upvote election ")

   const docs3 = await getLastDocuments(20)
   const electionDocType = "upvt.electn"
   const upElecDoc = docs3.find(item => JSON.stringify(item.content_groups).indexOf(electionDocType) != -1);
   console.log("election ID: " + upElecDoc.id)
   sleep(1000)

   // read all data into caches
   await updateGraph()

   const electionEdge = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE)[0]
   const electionDoc = documentCache[electionEdge.to_node]
   console.log("election doc " + electionDoc.id)

   const startRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, START_ROUND)
   const electionRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, ELECTION_ROUND)


   const startRoundEdge = startRoundEdges[0]

   const startRound = documentCache[startRoundEdge.to_node]


   // ACTION uesubmitseed(uint64_t dao_id, eosio::checksum256 seed, name account);
   const blockChainHeaderHash = await getBitcoinBlockHeader();
   console.log("latest block header: " + blockChainHeaderHash)

   const seedres = await contract.uesubmitseed(daoObj.id, blockChainHeaderHash, daoOwnerAccount, { authorization: `${daoOwnerAccount}@active` })
   //printMessage(seedres, "seedres ")

   await updateGraph()

   const electionDoc2 = documentCache[electionEdge.to_node]
   // console.log("election doc " + JSON.stringify(electionDoc2, null, 2))

   assert({
      given: 'seed was set correctly',
      should: 'has election round',
      actual: JSON.stringify(electionDoc2, null, 2).indexOf(blockChainHeaderHash) != -1,
      expected: true,
   })

   await sleep(1000)

   await updateGraph()


   /// =============================================================================
   /// Start first Election
   /// =============================================================================
   // ACTION updateupvelc(uint64_t election_id, bool reschedule);
   console.log("Start election")
   const updateVote = await contract.updateupvelc(upElecDoc.id, false, true, { authorization: `${daoContract}@active` });
   printMessage(updateVote, "update result")

   await sleep(1000)

   await updateGraph() 

   // the election
   const election2 = documentCache[electionDoc.id]
   const startRound2 = documentCache[startRound.id]

   //console.log("election: " + JSON.stringify(election2, null, 2))
   //console.log("start round: " + JSON.stringify(startRound2, null, 2))


   assert({
      given: "no delegates",
      should: "cancel election",
      actual: JSON.stringify(election2).indexOf("canceled") != -1,
      expected: true,
   })

})


// not working...

// describe('clean existing delegate badges if there are any', async assert => {

//    if (!isLocal()) {
//       console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
//       return
//    }

//    const daoOwnerAccount = randomAccountName()
//    const newDaoName = randomAccountName()

//    console.log("New account " + daoOwnerAccount)
//    console.log("New dao " + newDaoName)

//    const contract = await eos.contract(daoContract)

//    // reset contract
//    console.log("reset " + daoContract)
//    await contract.reset({ authorization: `${daoContract}@active` })
//    await sleep(500);

//    // create newaccount
//    await createAccount({
//       account: daoOwnerAccount,
//       publicKey: newAccountPublicKey,
//       creator: owner
//    })
//    await sleep(1000);

//    // create root
//    console.log("create root " + daoContract)
//    await contract.createroot('test root', { authorization: `${daoContract}@active` });
//    const docs = await getLastDocuments(5)

//    // create members
//    const numberOfMembers = 5
//    const members = await createMultipleAccounts(numberOfMembers)
//    console.log("created members: " + members.length)

//    console.log("badges initialized ")
//    const delegateBadge = docs.find(item => JSON.stringify(item.content_groups).indexOf("Upvote Delegate Badge") != -1);
//    const delegateBadgeId = delegateBadge.id
//    // console.log("delegate badge " + JSON.stringify(delegateBadge, null, 2))
//    // console.log("delegate badge id " + delegateBadgeId)
//    const hasDelegateBadge = JSON.stringify(docs).indexOf("Upvote Delegate Badge") != -1;

//    await sleep(1000);

//    // init initial settings
//    console.log("set intial settings ")
//    await initializeDHO()

//    console.log("create calendar ")
//    await contract.createcalen(true, { authorization: `${daoContract}@active` })
//    await sleep(1000);

//    const docs2 = await getLastDocuments(30)
//    const startPerString = "Calendar start period"
//    const startPeriodDoc = docs2.find(item => JSON.stringify(item.content_groups).indexOf(startPerString) != -1);

//    console.log("start period doc " + JSON.stringify(startPeriodDoc));

//    // create dao
//    console.log("create dao " + newDaoName + " with owner " + daoOwnerAccount)
//    const daoParams = getCreateDaoData({
//       dao_name: newDaoName,
//       onboarder_account: daoOwnerAccount,
//    })

//    /// =============================================================================
//    /// Create a new DAO
//    /// =============================================================================

//    await contract.createdao(daoParams, { authorization: `${daoOwnerAccount}@active` });

//    const getDaoEntry = async (daoName) => {
//       const accountsTable = await eos.getTableRows({
//          code: daoContract,
//          scope: daoContract,
//          table: 'daos',
//          lower_bound: daoName,
//          upper_bound: daoName,
//          json: true
//       });
//       return accountsTable.rows[0];
//    };

//    const checkCurrentRound = (title, electionDoc) => {
//       const currentRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
//       assert({
//          given: title + ' groups vote update',
//          should: 'only 1 current round',
//          actual: currentRoundEdges.length,
//          expected: 1,
//       })
//       return findFirstDocumentByFromNodeAndEdgeName(electionDoc.id, CURRENT_ROUND)
//    }
   
//    const daoObj = await getDaoEntry(newDaoName)
//    console.log("DAO id: " + daoObj.id + " Name: " + newDaoName)

//    console.log("create upvote data")
//    let data = getUpvoteElectionDoc()

//    /// =============================================================================
//    /// Create the 1st election (of 2)
//    /// =============================================================================

//    // ACTION createupvelc(uint64_t dao_id, ContentGroups& election_config)
//    console.log("create upvote election")
//    const createTx = await contract.createupvelc(daoObj.id, data, { authorization: `${daoOwnerAccount}@active` })
//    printMessage(createTx, "upvote election ")

//    const docs3 = await getLastDocuments(20)
//    const electionDocType = "upvt.electn"
//    const upElecDoc = docs3.find(item => JSON.stringify(item.content_groups).indexOf(electionDocType) != -1);
//    console.log("election ID: " + upElecDoc.id)
//    sleep(1000)

//    // read all data into caches
//    await updateGraph()

//    const electionEdge = findEdgesByFromNodeAndEdgeName(daoObj.id, ELECTION_EDGE)[0]
//    const electionDoc = documentCache[electionEdge.to_node]
//    console.log("election doc " + electionDoc.id)

//    const startRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, START_ROUND)
//    const electionRoundEdges = findEdgesByFromNodeAndEdgeName(electionDoc.id, ELECTION_ROUND)


//    const startRoundEdge = startRoundEdges[0]

//    const startRound = documentCache[startRoundEdge.to_node]

//    /// =============================================================================
//    /// Sign up members for the election 1
//    /// =============================================================================
//    const autoAddDelegateBadge = async (member) => {
//       await contract.autoenroll(daoObj.id, daoOwnerAccount, member, { authorization: `${daoOwnerAccount}@active` });
//       const badgeProposalData = getBadgeAssignmentPropData({
//          assignee: member,
//          badgeTitle: "Delegate Badge",
//          badgeId: delegateBadge.id,
//          startPeriodId: startPeriodDoc.id,
//       })

//       await contract.propose(
//          daoObj.id,
//          member,
//          "assignbadge",
//          badgeProposalData,
//          true,
//          { authorization: `${member}@active` }
//       )
//    }
//    for (let member of members) {
//       await autoAddDelegateBadge(member)
//    }

//    await sleep(1000)

//    await updateGraph()

//    /// =============================================================================
//    /// 1 Update Election 1
//    /// =============================================================================
//    // ACTION updateupvelc(uint64_t election_id, bool reschedule);
//    console.log("Start election")
//    const updateVote = await contract.updateupvelc(upElecDoc.id, false, true, { authorization: `${daoContract}@active` });
//    printMessage(updateVote, "updateVote result")

//    await sleep(1000)

//    /// =============================================================================
//    /// 2 Update Election 1
//    /// =============================================================================
//    console.log("Next round -> finish election")
//    const updateVote2 = await contract.updateupvelc(upElecDoc.id, false, true, { authorization: `${daoContract}@active` });
//    printMessage(updateVote2, "updateVote2 result")

//    await updateGraph() 

//    // the election
//    const election2 = documentCache[electionDoc.id]

//    console.log("election: " + JSON.stringify(election2, null, 2))
//    //console.log("start round: " + JSON.stringify(startRound2, null, 2))

//    const chiefDelegateEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, CHIEF_DELEGATE)
//    const headDelegateEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, HEAD_DELEGATE)

//    assert({
//       given: "only 5 members in election",
//       should: "have 4 CDs",
//       actual: chiefDelegateEdges.length,
//       expected: numberOfMembers - 1,
//    })

//    assert({
//       given: "only 5 members in election",
//       should: "have 1 HD",
//       actual: headDelegateEdges.length,
//       expected: 1,
//    })

//    assert({
//       given: "only 5 members in election",
//       should: "finished election",
//       actual: JSON.stringify(election2).indexOf("finished") != -1,
//       expected: true,
//    })

//    /// =============================================================================
//    /// End of first election
//    /// =============================================================================


//    /// =============================================================================
//    /// Create the 2nd election (of 2)
//    /// =============================================================================
//    console.log("create upvote election 2")
//    const createTx2 = await contract.createupvelc(daoObj.id, data, { authorization: `${daoOwnerAccount}@active` })
//    printMessage(createTx2, "upvote election ")
//    sleep(1000)
//    await updateGraph() 


//    const secondElectionDoc = findFirstDocumentByFromNodeAndEdgeName(daoObj.id, UPCOMING_ELECTION)

//    console.log("election ID: " + secondElectionDoc.id)

//    /// =============================================================================
//    /// Sign up members for the election 2
//    /// =============================================================================
//    for (let member of members) {
//       try {
//          await autoAddDelegateBadge(member)
//       } catch (error) {
//          console.log("error adding " + member +  ": " + error)
//       }
//    }

//    await sleep(1000)

//    /// =============================================================================
//    /// 1 Update Election 2
//    /// =============================================================================
//    // ACTION updateupvelc(uint64_t election_id, bool reschedule);
//    console.log("Start election 2")
//    const updateVote3 = await contract.updateupvelc(secondElectionDoc.id, false, true, { authorization: `${daoContract}@active` });
//    printMessage(updateVote3, "updateVote3 result")
//    await sleep(1000)

//    /// =============================================================================
//    /// 2 Update Election 2
//    /// =============================================================================
//    console.log("Next round E2 -> finish election")
//    const updateVote4 = await contract.updateupvelc(secondElectionDoc.id, false, true, { authorization: `${daoContract}@active` });
//    printMessage(updateVote4, "updateVote4 result")
//    await updateGraph() 

//    const chiefDelegateEdges2 = findEdgesByFromNodeAndEdgeName(daoObj.id, CHIEF_DELEGATE)
//    const headDelegateEdges2 = findEdgesByFromNodeAndEdgeName(daoObj.id, HEAD_DELEGATE)
//    const previousElectionDoc = findFirstDocumentByFromNodeAndEdgeName(daoObj.id, PREVIOUS_ELECTION)

//    assert({
//       given: "only 5 members in election",
//       should: "have 4 CDs",
//       actual: chiefDelegateEdges2.length,
//       expected: numberOfMembers - 1,
//    })

//    assert({
//       given: "only 5 members in election",
//       should: "have 1 HD",
//       actual: headDelegateEdges2.length,
//       expected: 1,
//    })


//    assert({
//       given: "only 5 members in election",
//       should: "finished election",
//       actual: JSON.stringify(previousElectionDoc).indexOf("finished") != -1,
//       expected: true,
//    })
//    assert({
//       given: "election ended",
//       should: "previous election is set to election",
//       actual: secondElectionDoc.id,
//       expected: previousElectionDoc.id,
//    })

// })

