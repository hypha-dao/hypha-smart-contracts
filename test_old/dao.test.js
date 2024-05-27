const { describe } = require('riteway')
const { eos, names, getTableRows, isLocal, getBalance, sleep } = require('../scripts/helper')
const getCreateDaoData = require("./helpers/getCreateDaoData")
const initDhoSettings = require("./helpers/initDhoSettings")

const eosjs = require('eosjs')
const { Serialize } = eosjs

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
const { initAllDHOSettings } = require('./helpers/daoHelpers')


/// prints the message from a transaction result object
/// we get this as a return value any time we execute a transaction
const printMessage = (txresult, title = "tx result") => {
   const consoleMessage = txresult.processed.action_traces[0].console;
   console.log(title + ": " + JSON.stringify(consoleMessage, null, 2))
}

////////////////////////////////////////////////////////////////////////
/////////// Main unit test
////////////////////////////////////////////////////////////////////////

describe('dao test deferred actions', async assert => {

   if (!isLocal()) {
      console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
      return
   }

   const contract = await eos.contract(daoContract)

   const contractName = daoContract

   // reset contract
   console.log("reset " + daoContract)
   await contract.reset({ authorization: `${daoContract}@active` })

   const { hasDelegateBadge, startPeriodDoc, delegateBadge } = await initAllDHOSettings(contract, daoContract);

     // Get the current date and time
  const currentDate = new Date();

  // Calculate the Unix timestamp (seconds since epoch)
  const unixTimestamp = Math.floor(currentDate.getTime() / 1000);

  console.log("unix: " + unixTimestamp);

  const nowTimePoint = Serialize.timePointSecToDate(unixTimestamp)
  const timePast = Serialize.timePointSecToDate(unixTimestamp - 10)
  const time3Seconds = Serialize.timePointSecToDate(unixTimestamp + 3)
  const time10Seconds = Serialize.timePointSecToDate(unixTimestamp + 10)
  const time3000Seconds = Serialize.timePointSecToDate(unixTimestamp + 3000)

  console.log("time point: " + nowTimePoint);


  console.log("adding action past");

  //const nonce = unixTimestamp + ""

  const text1 =  "two string "
  const text2 =  "in 3 secs "
  const text3 =  "in 10 seconds "

  await contract.addtest( timePast, 2, text1, { authorization: `${contractName}@active` })
  console.log("adding action 3");
  await contract.addtest( time3Seconds, 3, text2, { authorization: `${contractName}@active` })
  console.log("adding action 10");
  await contract.addtest( time10Seconds, 10, text3, { authorization: `${contractName}@active` })

  console.log("getting tablecleos");

  const getDeferred = async () => await eos.getTableRows({
    code: contractName,
    scope: contractName,
    table: 'defactions',
    json: true,
  })

  const getTestEntries = async () => {
    return await eos.getTableRows({
      code: contractName,
      scope: contractName,
      table: 'testdtrx',
      json: true,
    })
  
  }

  const deferredActions = await getDeferred();

  console.log("defactions "+JSON.stringify(deferredActions, 0, 2))

  assert({
    given: `added actions`,
    should: "have actions",
    actual: deferredActions.rows.length,
    expected: 3
  })

  const testEntries = await getTestEntries()

  console.log("testEntries "+JSON.stringify(testEntries, 0, 2))

  await contract.executenext( { authorization: `${owner}@active` })

  const testEntries2 = await getTestEntries()

  console.log("testEntries2 "+JSON.stringify(testEntries2, 0, 2))

  const deferredActions2 = await getDeferred();

  console.log("deferredActions2 "+JSON.stringify(deferredActions2, 0, 2))

  // console.log("adding action 3000");
  // await contract.addtest( time3000Seconds, 3000, "late action", { authorization: `${contractName}@active` })

  await sleep(1000)

  let noActionsToExecute = false
  try {
    await contract.executenext( { authorization: `${owner}@active` })
  } catch (error) {
    const message = ""+error
    const hasCorrectErrorMessage = message.indexOf("No deferred actions") != -1
    noActionsToExecute = hasCorrectErrorMessage
    console.log("expected error " + error)
  }

  assert({
    given: `executed 1 action`,
    should: "have actions",
    actual: deferredActions2.rows.length,
    expected: deferredActions.rows.length - 1
  })

  assert({
    given: `executed 1 action`,
    should: "have actions",
    actual: testEntries2.rows[0],
    expected: {
      "id": 0,
      "number": 2,
      "text": text1
    }
  })

  assert({
    given: `no actions ready`,
    should: "have error message",
    actual: noActionsToExecute,
    expected: true
  })

  await sleep(2500)

  await contract.executenext( { authorization: `${owner}@active` })

  const testEntries3 = await getTestEntries()

  console.log("testEntries3 "+JSON.stringify(testEntries3, 0, 2))

  const deferredActions3 = await getDeferred();

  assert({
    given: `executed second action`,
    should: "have actions",
    actual: testEntries3.rows[1],
    expected: {
      "id": 1,
      "number": 3,
      "text": text2
    }
  })
  
  assert({
    given: `executed 2 action`,
    should: "have 1 left",
    actual: deferredActions3.rows.length,
    expected: deferredActions.rows.length - 2
  })




})

