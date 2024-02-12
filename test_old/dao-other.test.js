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

