const { describe } = require('riteway')

const { eos, names, getTableRows, initContracts } = require('../scripts/helper.js')

const { owner, voice_token, firstuser } = names

describe('Voice token', async assert => {

  const contracts = await initContracts({ voice_token })

  const daoTenantName = "daotenant5"
  
  console.log(`${owner} transfer token to ${firstuser}`)
  try {
    await contracts.voice_token.create(daoTenantName, owner, "-1.00 VOICE", 200, 0, { authorization: `${voice_token}@active` })
  } catch (err) {
    console.log("create error: " + err)
    // ignore - token exists
  }

  const getBalance = async (tenant, user) => {
    const balances = await eos.getTableRows({
        code: voice_token,
        scope: user,
        table: 'accounts.v2',
        json: true,
        limit: 10
      })
      console.log("balance for user " + user + " " + JSON.stringify(balances, null, 2))
      for (item of balances.rows) {
        if (item.tenant == tenant) {
            return parseFloat(item.balance.split(" ")[0])
        }
      }
      return 0
  }

//   const ownerBalanceBefore = await getBalance(daoTenantName, owner)

//   console.log("owner balance: " + JSON.stringify(ownerBalanceBefore, null, 2))

  console.log(`issue`)
  await contracts.voice_token.issue(daoTenantName, owner, '100.00 VOICE', `init`, { authorization: `${owner}@active` })

  const ownerBalance = await getBalance(daoTenantName, owner)
  console.log("owner balance after issue: " + JSON.stringify(ownerBalance, null, 2))

  console.log(`transfer to first user`)
  await contracts.voice_token.transfer(daoTenantName, owner, firstuser, "100.00 VOICE", 'unit test', { authorization: `${owner}@active` })
  const firstUserBalance =  await getBalance(daoTenantName, firstuser)

  console.log("first user balance: " + JSON.stringify(firstUserBalance, null, 2))

  const ownerBalanceAfter = await getBalance(daoTenantName, owner)

  console.log("owner balance after transfer: " + JSON.stringify(ownerBalanceAfter, null, 2))

  console.log(`burn`)
  await contracts.voice_token.burn(daoTenantName, firstuser,  "100.00 VOICE", "memo", { authorization: `${firstuser}@active` })

  const firstUserBalanceAfter = await getBalance(daoTenantName, firstuser)

  console.log("first user balance after: " + JSON.stringify(firstUserBalanceAfter, null, 2))


  assert({
    given: `after issue`,
    should: "owner has balance",
    actual: ownerBalance,
    expected: 100
  })
  assert({
    given: `after transfer owner`,
    should: "owner has no balance",
    actual: ownerBalanceAfter,
    expected: 0
  })
  assert({
    given: `after transfer first user`,
    should: "first user has balance",
    actual: firstUserBalance,
    expected: 100
  })
  assert({
    given: `after burn`,
    should: "first user has no balance",
    actual: firstUserBalanceAfter,
    expected: 0
  })


})

