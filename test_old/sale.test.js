const { describe } = require('riteway')

const { eos, names, getTableRows, initContracts } = require('../scripts/helper.js')

const { owner, hyphatoken, husd_token, tlostoken, tier_vesting, sale, launch_sale, firstuser } = names


const getBalanceFloat = async (user) => {
  const balance = await eos.getCurrencyBalance(names.hyphatoken, user, 'HYPHA')
  var float = parseInt(Math.round(parseFloat(balance[0]) * 100)) / 100.0;
  return float;
}

describe('Sale', async assert => {

  const contracts = await initContracts({ hyphatoken, sale, husd_token })
  
  console.log(`reset sale`)
  await contracts.sale.reset({ authorization: `${sale}@active` })  

  console.log(`${owner} transfer token to ${firstuser}`)
  try {
    await contracts.hyphatoken.create(owner, "-1.00 HYPHA", { authorization: `${hyphatoken}@active` })
  } catch (err) {
    // ignore - token exists
  }

  // console.log(`issue`)
  // await contracts.hyphatoken.issue(owner, '10000000.00 HYPHA', `init`, { authorization: owner+`@active` })

  // try {
  //   await contracts.husd_token.create(owner, "-1.00 HUSD", { authorization: `${husd_token}@active` })
  //   console.log(`issue`)
  //   await contracts.husd_token.issue(owner, '10000000.00 HUSD', `init`, { authorization: owner+`@active` })
  // } catch (err) {
  //   // ignore - token exists
  // }
  // console.log(`transfer to sale`)
  // await contracts.husd_token.transfer(owner, firstuser, "10000.00 HUSD", 'unit test', { authorization: `${owner}@active` })


  console.log(`transfer to sale`)
  await contracts.hyphatoken.transfer(owner, sale, "1000.00 HYPHA", 'unit test', { authorization: `${owner}@active` })

  console.log(`set limit`)
  await contracts.sale.setflag("whtlst.limit",  100000 * 100, { authorization: `${sale}@active` })

  console.log(`initrounds`)

  await contracts.sale.initrounds( (100) * 100, "2.00 USD", "1.00 USD", 10, { authorization: `${sale}@active` })

  let rounds = await getRounds()
  // console.log("rounds "+JSON.stringify(rounds, null, 2))

  let balanceBefore = await getBalanceFloat(firstuser)

  console.log("balance before "+balanceBefore)

  let soldBefore = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'sold',
    json: true,
  })

  // console.log("soldBefore "+JSON.stringify(soldBefore, 0, 2))

  var usd = 120
  const expectedHypha1 = 60

  await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "0x3affgf", parseInt(usd * 10000), { authorization: `${sale}@active` })

  let balanceAfter = await getBalanceFloat(firstuser)

  let soldAfter = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'sold',
    json: true,
  })

  // console.log("sold after "+JSON.stringify(soldAfter, 0, 2))

  assert({
    given: `sent ${usd} USD to sale`,
    should: `receive ${expectedHypha1} to account going from `+balanceBefore + ' to ' + balanceAfter,
    actual: balanceAfter,
    expected: balanceBefore + expectedHypha1
  })

  usd = 501
  // 40 H x 2 = 80 USD  = 40 H
  // 100 H x 3 = 300 USD = 100 H
  // 30.25 H x 4 = 121 USD = 30.25 H
  const expectedHypha2 = 170.25

  await contracts.sale.newpayment(firstuser, "BTC", "0.00001133",  "0x9113affgf", parseInt(usd * 10000), { authorization: `${sale}@active` })

  let balanceAfter2 = await getBalanceFloat(firstuser)
  console.log("balanceAfter2 "+balanceAfter2)

  assert({
    given: `sent ${usd} USD to sale`,
    should: `receive ${expectedHypha2} to account going from `+balanceAfter + ' to ' + balanceAfter2 + ' GOT ' + (balanceAfter2 - balanceAfter),
    actual: balanceAfter2,
    expected: balanceAfter + expectedHypha2
  })

  let soldAfterAfter = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'sold',
    json: true,
  })

  console.log("soldAfterAfter "+JSON.stringify(soldAfterAfter, 0, 2))

  console.log("test exceed balance ")

  usd = 90000

  let canExceedBalance = false
  try {
    await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "0xs3affgf999", usd * 10000, { authorization: `${sale}@active` })
    canExceedBalance = true
  } catch (err) {
    console.log("exceed balance expected error: "+err)
  }

  console.log("test duplicate transaction")

  let allowDuplicateTransaction = false
  try {
    await contracts.sale.newpayment(firstuser, "BTC",  "0.00001123",  "0x3affgf", parseInt(usd * 10000), { authorization: `${sale}@active` })
    allowDuplicateTransaction = true
  } catch (err) {
    console.log("duplicate transaction expected error: "+err)
  }

  console.log("test pause")
  // test pause / unpause
  await contracts.sale.pause({ authorization: `${sale}@active` })

  let allowPaused = false
  try {
    await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "1001", 2, { authorization: `${sale}@active` })
    allowPaused = true
  } catch (err) {
    console.log("expected error: "+err);
  }

  console.log("test rounds reset")
  // test reset to one big round
  // ACTION initrounds(uint64_t volume_per_round, asset initial_token_per_usd, asset linear_increment, uint64_t num_rounds);
  await contracts.sale.unpause({ authorization: `${sale}@active` })
  await contracts.sale.initrounds( (1000) * 100, "1.00 USD", "0.00 USD", 1, { authorization: `${sale}@active` })

  const usd1 = 7
  await contracts.sale.newpayment(firstuser, "BTC", "0.0001",  "0x0001111", parseInt(usd1 * 10000), { authorization: `${sale}@active` })

  let sold1 = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'sold',
    json: true,
  })
  console.log("sold1 "+JSON.stringify(sold1, 0, 2))
  let balance1 = await getBalanceFloat(firstuser)
  console.log("balance1 "+balance1)

  assert({
    given: `contract paused`,
    should: "can't make transactions",
    actual: allowPaused,
    expected: false
  })

  assert({
    given: 'sent hypha',
    should: 'update sold',
    actual: soldAfter.rows[0].total_sold,
    expected: soldBefore.rows[0].total_sold + expectedHypha1 * 100
  })

  assert({
    given: 'sent hypha',
    should: 'update sold second time',
    actual: soldAfterAfter.rows[0].total_sold,
    expected: soldBefore.rows[0].total_sold + (expectedHypha1 + expectedHypha2)  * 100
  })

  assert({
    given: `user buys more than they are allowed`,
    should: `fail`,
    actual: canExceedBalance,
    expected: false
  })

  assert({
    given: `newpurchase called multiple times with same transaction`,
    should: `fail`,
    actual: allowDuplicateTransaction,
    expected: false
  })

  assert({
    given: `exceeded balance`,
    should: `have error`,
    actual: canExceedBalance,
    expected: false
  })

  assert({
    given: 'one round reset - sold',
    should: 'sold 7 more tokens',
    actual: sold1.rows[0].total_sold,
    expected: soldAfterAfter.rows[0].total_sold + 7 * 100
  })

  assert({
    given: 'one round reset - bought',
    should: 'bought 7 more tokens for 7 usd',
    actual: balance1,
    expected: balanceAfter2 + 7
  })

})

describe('Basic Init Check', async assert => {

  const contracts = await initContracts({ hyphatoken, sale })
  
  console.log(`reset sale`)
  await contracts.sale.reset({ authorization: `${sale}@active` })  

  console.log(`init token sale rounds`)
  await contracts.sale.initsale({ authorization: `${sale}@active` })

  let rounds = await getRounds()

  // console.log("rounds "+JSON.stringify(rounds, null, 2))

  initial = 1
  price = initial
  increment = 0.03
  volumePerRound = 100000
  initialVolume = 100000
  volume = initialVolume

  let results = []
  for(let i=0; i<rounds.rows.length; i++) {
    assert({
      given: 'round '+i,
      should: 'have price: ' + price + " HYPHA - Volume: "+volume,
      actual: { 
        price: rounds.rows[i].hypha_usd,
        volume: rounds.rows[i].max_sold
      },
      expected: {
        price: price.toFixed(2) + " USD",
        volume: volume * 100
      }
    })
    price += increment
    volume += volumePerRound
  }

})

const getRounds = async () => {
  let rounds = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'rounds',
    json: true,
    limit: 100,
  })
  return rounds
}

describe('Token Sale Price', async assert => {

  const contracts = await initContracts({ hyphatoken, sale })
  
  console.log(`reset sale`)
  await contracts.sale.reset({ authorization: `${sale}@active` })  

  console.log(`transfer H to ${sale}`)
  await contracts.hyphatoken.transfer(owner, sale, "20000.00 HYPHA", 'unit test', { authorization: `${owner}@active` })
  
  console.log(`init token sale rounds`)

  console.log("test init rounds - 10.00 hypha per round")

  for (let i=0; i<12; i++) {
    await contracts.sale.addround( 10 * 100, i+1+".00 HYPHA", { authorization: `${sale}@active` })  
  }

  console.log("rounds "+JSON.stringify(await getRounds(), null, 2))

  let b1 = await getBalanceFloat(firstuser)

  const updateprice = async (expected_round, expected_price, expected_remaining) => {

    let price = await eos.getTableRows({
      code: sale,
      scope: sale,
      table: 'price',
      json: true,
    })
    
    console.log("price: "+JSON.stringify(price, null, 2))

    assert({
      given: `new price`,
      should: `expected round: `+expected_round + " price: "+expected_price + " remaining "+expected_remaining,
      actual: price.rows[0],
      expected: {
        "id": 0,
        "current_round_id": expected_round,
        "hypha_usd": parseInt(expected_price)+".00 HYPHA",
        "remaining": expected_remaining
      }
    })

  }

  const check = async (initial, expectedDelta, usd) => {
    let balance = await getBalanceFloat(firstuser)
    let delta = balance - initial
    //console.log(" expected "+expectedDelta + " actual " + delta + " initial "+ initial + " balance: "+ balance)

    assert({
      given: `purchase `+usd+" usd worth",
      should: `receive expected number of Hypha: `+expectedDelta,
      actual: delta.toFixed(4),
      expected: expectedDelta.toFixed(4)
    })
  
  }

  console.log("buy hypha 10 USD")

  // edge case, buy entire round, check price after
  await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "0", parseInt(10 * 10000), { authorization: `${sale}@active` })

  let seedsBalance = 10

  console.log("foobar")

  await check(b1, seedsBalance, 10)

  b1 += seedsBalance

  console.log("update price")
  await updateprice(1, 2, 10 * 100)


  console.log("buy hypha 0.5 USD")

  await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "01", parseInt(5000), { authorization: `${sale}@active` })

  var expectedHypha = 0.5 / 2

  await check(b1, expectedHypha, 0.5)

  b1 += 1

  await updateprice(1, 2, 10 * 100 - expectedHypha * 100)

  console.log("check price history entry") 

  let priceHistoryAfter = await eos.getTableRows({
    code: sale,
    scope: sale,
    table: 'pricehistory',
    json: true,
  })

  delete priceHistoryAfter.rows[0].date
  delete priceHistoryAfter.rows[1].date
  
  assert({
    given: 'price changed',
    should: 'insert new entry in price history',
    actual: priceHistoryAfter.rows,
    expected: [ 
      { 
        id: 0, 
        hypha_usd: '1.00 HYPHA' 
      },
      { 
        id: 1, 
        hypha_usd: '2.00 HYPHA' 
      }
    ]
  })

  // let price1 = await eos.getTableRows({
  //   code: sale,
  //   scope: sale,
  //   table: 'price',
  //   json: true,
  // })
  // console.log("price1 "+JSON.stringify(price1, null, 2))

  console.log("buy hypha 6 USD") 

  let balanceBuy6 = await getBalanceFloat(firstuser)

  await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "02", parseInt(6 * 10000), { authorization: `${sale}@active` })

  // let price2 = await eos.getTableRows({
  //   code: sale,
  //   scope: sale,
  //   table: 'price',
  //   json: true,
  // })
  // console.log("price2 "+JSON.stringify(price2, null, 2))

  await check(balanceBuy6, 3, "6")

  await updateprice(1, 2,  675)

  const usd1 = 675 * 2
  const usd2 = 2022 - 675 * 2

  const hypha = 675 + usd2 / 3
  const hypha_at_3_spent = usd2 / 3

  console.log("buy hypha 20.22 USD")

  let balanceBuy7 = await getBalanceFloat(firstuser)

  await contracts.sale.newpayment(firstuser, "BTC", "0.00001123",  "04", parseInt(20.22 * 10000), { authorization: `${sale}@active` })

  await check(balanceBuy7, hypha / 100, "20.22")

  await updateprice(2, 3, 1000 - hypha_at_3_spent)

})

// describe('HUSD', async assert => {

//   console.log("README: Comment in 'testhusd' action in the sale contract")
//   console.log("README: You have to either have a husd.hypha contract deployed")
//   console.log("or you comment out the husd burn in the on_husd function")

//   const contracts = await initContracts({ sale })
//   console.log(`reset exchange`)
  
//   await contracts.sale.reset({ authorization: `${sale}@active` })  

//   console.log(`update daily limits`)
//   await contracts.sale.initrounds( (100) * 100, "2.00 USD", "1.00 USD", 10, { authorization: `${sale}@active` })

//   console.log(`test husd`)
//   const balanceBefore = await getBalanceFloat(firstuser)
//   await contracts.sale.testhusd(firstuser, "x", "0.10 HUSD", { authorization: `${sale}@active` })
//   const balanceAfter = await getBalanceFloat(firstuser)

//   console.log("b4: "+ balanceBefore)
//   console.log("after: "+ balanceAfter)
// })

describe('whitelist and limits', async assert => {

  const contracts = await initContracts({ sale })
  console.log(`reset exchange`)
  
  await contracts.sale.reset({ authorization: `${sale}@active` })  


  console.log(`update daily limits`)
  await contracts.sale.initrounds( (100) * 100, "1.00 USD", "0.00 USD", 1, { authorization: `${sale}@active` })

  console.log(`test limit`)
  await contracts.sale.setflag("whtlst.limit",  1 * 100, { authorization: `${sale}@active` })

  const balanceBefore = await getBalanceFloat(firstuser)

  let canBuyBelowLimit = false;

  console.log(`new payment`)
  await contracts.sale.newpayment(firstuser, "BTC", "0.000000001",  "000001", parseInt(1 * 10000), { authorization: `${sale}@active` })
  canBuyBelowLimit = true;

  let canBuyAboveLimit = false;
  try {
    await contracts.sale.newpayment(firstuser, "BTC", "0.000000001",  "000002", parseInt(1 * 1000), { authorization: `${sale}@active` })
    canBuyAboveLimit = true;
  } catch (err) {
    console.log("expected error, over limit")
    console.log(err)
  }

  console.log("whitelist first user")
  await contracts.sale.addwhitelist(firstuser, { authorization: `${sale}@active` })

  let whiteListBuy = false;
  try {
    await contracts.sale.newpayment(firstuser, "BTC", "0.000000001",  "000003", parseInt(1 * 1000), { authorization: `${sale}@active` })
    whiteListBuy = true;
  } catch (err) {
    console.log("expected error, over limit")
    console.log(err)
  }

  console.log("remove whitelist for first user")
  await contracts.sale.remwhitelist(firstuser, { authorization: `${sale}@active` })

  let noWhiteListBuy = false;
  try {
    await contracts.sale.newpayment(firstuser, "BTC", "0.000000001",  "000004", parseInt(1 * 1000), { authorization: `${sale}@active` })
    noWhiteListBuy = true;
  } catch (err) {
    console.log("expected error, off whitelist")
    console.log(err)
  }

  const balanceAfter = await getBalanceFloat(firstuser)

  console.log("before: "+balanceBefore)
  console.log("after: "+balanceAfter)
  console.log("delta: "+(balanceAfter - balanceBefore))

  assert({
    given: 'under limit',
    should: 'able to buy',
    actual: canBuyBelowLimit,
    expected: true
  })

  assert({
    given: 'over limit',
    should: 'unable to buy',
    actual: canBuyAboveLimit,
    expected: false
  })
  assert({
    given: 'on whitelist',
    should: 'can buy',
    actual: whiteListBuy,
    expected: true
  })
  assert({
    given: 'off whitelist',
    should: 'cant buy over limit',
    actual: noWhiteListBuy,
    expected: false
  })


})

const getLocksTable = async (lockId) => {
  return eos.getTableRows({
      code: tier_vesting,
      scope: tier_vesting,
      table: 'locks',
      json: true
  })
}

describe('launch sale mode - locks', async assert => {

  const contracts = await initContracts({ tier_vesting, launch_sale, hyphatoken })
  console.log(`reset`)
  
  await contracts.launch_sale.reset({ authorization: `${launch_sale}@active` })  
  await contracts.tier_vesting.reset({ authorization: `${tier_vesting}@active` })  
  
  
  console.log(`transfer to sale`)
  await contracts.hyphatoken.transfer(owner, launch_sale, "1000.00 HYPHA", 'launch_sale unit test', { authorization: `${owner}@active` })

  console.log(`init`)
  await contracts.launch_sale.initrounds( (1000) * 100, "0.50 USD", "0.00 USD", 1, { authorization: `${launch_sale}@active` })
  
  console.log(`add "launch" tier - that's where tokens go`)
  await contracts.tier_vesting.addtier("launch", "0.00 HYPHA", "Launch stakeholders", { authorization: `${tier_vesting}@active` })

  console.log(`test limit`)
  await contracts.launch_sale.cfglaunch(tier_vesting, { authorization: `${launch_sale}@active` })

  const balanceBefore = await getBalanceFloat(firstuser)
  const vestingBalance = await getBalanceFloat(tier_vesting) ?? 0
  const saleBalance = await getBalanceFloat(launch_sale)

  console.log(`new payment`)
  // await contracts.launch_sale.newpayment(firstuser, "BTC", "0.00001123",  "0x3affgf", parseInt(usd * 10000), { authorization: `${sale}@active` })

  await contracts.launch_sale.newpayment(firstuser, "USD", "2.0",  "00000123", parseInt(2 * 10000), { authorization: `${launch_sale}@active` })

  const balanceAfter = await getBalanceFloat(firstuser)
  const vestingBalanceAfter = await getBalanceFloat(tier_vesting)
  const saleBalanceAfter = await getBalanceFloat(launch_sale)
  const locks = await getLocksTable();

  // console.log("before: "+vestingBalance)
  // console.log("after: "+vestingBalanceAfter)
  // console.log("locks: "+JSON.stringify(locks, null, 2))

  assert({
    given: 'purchase user',
    should: 'same balance',
    actual: balanceAfter,
    expected: balanceBefore
  })

  assert({
    given: 'purchase vesting',
    should: 'inc balance',
    actual: vestingBalanceAfter,
    expected: vestingBalance + 4
  })

  assert({
    given: 'purchase sale',
    should: 'dec balance',
    actual: saleBalanceAfter,
    expected: saleBalance - 4
  })

  assert({
    given: 'purchase - check lock',
    should: 'add lock',
    actual: locks.rows[0],
    expected: {
      "lock_id": 0,
      "owner": firstuser,
      "tier_id": "launch",
      "amount": "4.00 HYPHA",
      "claimed_amount": "0.00 HYPHA",
      "note": "00000123"
    }
  })





})