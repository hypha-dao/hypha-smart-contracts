const { describe } = require('riteway')

const eosjs = require('eosjs')
const { Serialize } = eosjs

const { eos, names, getTableRows, initContracts, sleep } = require('../scripts/helper.js')

const { owner, deferredtrx, firstuser } = names


describe('Deferred transactions', async assert => {

  const contracts = await initContracts({ deferredtrx })
  
  console.log(`reset dtx`)
  await contracts.deferredtrx.reset({ authorization: `${deferredtrx}@active` })  

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

  await contracts.deferredtrx.addtest( timePast, 2, text1, { authorization: `${deferredtrx}@active` })
  console.log("adding action 3");
  await contracts.deferredtrx.addtest( time3Seconds, 3, text2, { authorization: `${deferredtrx}@active` })
  console.log("adding action 10");
  await contracts.deferredtrx.addtest( time10Seconds, 10, text3, { authorization: `${deferredtrx}@active` })

  console.log("getting tablecleos");

  const getDeferred = async () => await eos.getTableRows({
    code: deferredtrx,
    scope: deferredtrx,
    table: 'defactions',
    json: true,
  })

  const getTestEntries = async () => {
    return await eos.getTableRows({
      code: deferredtrx,
      scope: deferredtrx,
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

  await contracts.deferredtrx.executenext( { authorization: `${owner}@active` })

  const testEntries2 = await getTestEntries()

  console.log("testEntries2 "+JSON.stringify(testEntries2, 0, 2))

  const deferredActions2 = await getDeferred();

  console.log("deferredActions2 "+JSON.stringify(deferredActions2, 0, 2))

  // console.log("adding action 3000");
  // await contracts.deferredtrx.addtest( time3000Seconds, 3000, "late action", { authorization: `${deferredtrx}@active` })

  await sleep(1000)

  let noActionsToExecute = false
  try {
    await contracts.deferredtrx.executenext( { authorization: `${owner}@active` })
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

  await contracts.deferredtrx.executenext( { authorization: `${owner}@active` })

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
