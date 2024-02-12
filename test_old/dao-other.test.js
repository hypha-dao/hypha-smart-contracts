const { describe } = require('riteway')
const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('../scripts/helper')

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
   getDocumentById,
   updateGraph, 
} = require('./docGraph');

const { group } = require('console');
const getUpvoteElectionDoc = require('./helpers/getUpvoteElectionDoc');
const getBadgeAssignmentPropData = require('./helpers/getBadgeAssignmentPropData');
const { randomAccountName, initAllDHOSettings, createDAO, createMultipleAccounts, newAccountPublicKey, APPLICANT, APPLICANT_OF, MEMBER, MEMBER_OF, getMemberName } = require('./helpers/daoHelpers');

/// prints the message from a transaction result object
/// we get this as a return value any time we execute a transaction
const printMessage = (txresult, title = "tx result") => {
   const consoleMessage = txresult.processed.action_traces[0].console;
   console.log(title + ": " + JSON.stringify(consoleMessage, null, 2))
}

////////////////////////////////////////////////////////////////////////
/////////// Main unit test
////////////////////////////////////////////////////////////////////////


describe('test add and remove members', async assert => {

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
   const { hasDelegateBadge, startPeriodDoc, delegateBadge } = await initAllDHOSettings(contract, daoContract);

   const daoObj = await createDAO({contract, contractName: daoContract, newDaoName, daoOwnerAccount})

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

   const members = await createMultipleAccounts(1)
   console.log("created members: " + members.length)

   const member = members[0]

   console.log("apply to be on the DAO for member: " + member)
   // ACTION apply(const eosio::name &applicant, uint64_t dao_id, const std::string &content);
   await contract.apply(member, daoObj.id, "test", { authorization: `${member}@active` });

   await sleep(500)
   await updateGraph()

   const daoApplicantEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, APPLICANT)
   const memberId = daoApplicantEdges[0].to_node
   const daoApplicantToEdges = findEdgesByFromNodeAndEdgeName(memberId, APPLICANT_OF)


   
   console.log("enroll member")
   // ACTION enroll(const eosio::name &enroller, uint64_t dao_id, const eosio::name &applicant, const std::string &content);
   await contract.enroll(daoOwnerAccount, daoObj.id, member, "no comment", { authorization: `${daoOwnerAccount}@active` });

   await sleep(500)
   await updateGraph() 

   const daoApplicantEdgesAfter = findEdgesByFromNodeAndEdgeName(daoObj.id, APPLICANT)
   const daoApplicantToEdgesAfter = findEdgesByFromNodeAndEdgeName(memberId, APPLICANT_OF)

   const daoMembersEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, MEMBER)
   const daoMembers = daoMembersEdges.map((e) => getMemberName(e.to_node))

   // const index = daoMembers.indexOf(member)
   // const memberId = daoMembersEdges[index].to_node

   const daoEdges = findEdgesByFromNodeAndEdgeName(memberId, MEMBER_OF)
   const daoDocs = daoEdges.map(e => documentCache[e.to_node])

   console.log("members: " + JSON.stringify(daoMembers, null, 2))
   console.log("member dao for " + member + ": " + JSON.stringify(daoDocs, null, 2))

   console.log("remove member")
   // void dao::remmember(uint64_t dao_id, const std::vector<name>& member_names)
   await contract.remmember(daoObj.id, [member], { authorization: `${daoOwnerAccount}@active` });

   await sleep(500)
   await updateGraph() 

   const daoMembersAfter = findEdgesByFromNodeAndEdgeName(daoObj.id, MEMBER).map((e) => getMemberName(e.to_node))

   const daoEdgesAfter = findEdgesByFromNodeAndEdgeName(memberId, MEMBER_OF)
   const daoDocsAfter = daoEdgesAfter.map(e => documentCache[e.to_node])

   console.log("daoMembersAfter: " + JSON.stringify(daoMembersAfter, null, 2))
   console.log("daoDocsAfter " + member + ": " + JSON.stringify(daoDocsAfter, null, 2))

   assert({
      given: 'member was enrolled',
      should: 'member is listed in dao edges',
      actual:  daoMembers.indexOf(member) != -1,
      expected: true
   })

   assert({
      given: 'member was enrolled 2',
      should: 'member has dao listed in edges',
      actual: daoDocs.length,
      expected: 1
   })

   assert({
      given: 'member was removed',
      should: 'member is not listed on dao edges',
      actual: daoMembersAfter.indexOf(member),
      expected: -1
   })

   assert({
      given: 'member was removed 2',
      should: 'member has no dao listed in edges',
      actual: daoDocsAfter.length,
      expected: 0
   })

   assert({
      given: 'member applied 1',
      should: 'member is applicant',
      actual: daoApplicantEdges.length,
      expected: 1
   })
   
   assert({
      given: 'member applied 2',
      should: 'dao is listed in applicant daos',
      actual: daoApplicantToEdges.length,
      expected: 1
   })

   assert({
      given: 'member enrolled',
      should: 'member is no longer an applicant',
      actual: daoApplicantEdgesAfter.length,
      expected: 0
   })
   
   assert({
      given: 'member enrolled - applicant',
      should: 'applicant removed',
      actual: daoApplicantToEdgesAfter.length,
      expected: 0
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

