const { describe } = require('riteway')

const eosjs = require('eosjs')
const { Serialize } = eosjs

const { eos, names, getTableRows, initContracts } = require('../scripts/helper.js')

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

  console.log("time point: " + nowTimePoint);


  console.log("adding action past");

  const nonce = unixTimestamp + ""

  await contracts.deferredtrx.addtest( timePast, 2, "two string " + nonce, { authorization: `${deferredtrx}@active` })
  console.log("adding action 3");
  await contracts.deferredtrx.addtest( time3Seconds, 3, "In 3 seconds " + nonce, { authorization: `${deferredtrx}@active` })
  console.log("adding action 10");
  await contracts.deferredtrx.addtest( time10Seconds, 10, "In 10 seconds " + nonce, { authorization: `${deferredtrx}@active` })

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

  // assert({
  //   given: `contract paused`,
  //   should: "can't make transactions",
  //   actual: allowPaused,
  //   expected: false
  // })


})
