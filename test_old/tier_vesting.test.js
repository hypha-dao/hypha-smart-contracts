

// [[eosio::action]]
// void release(name tier_id, asset amount);

// [[eosio::action]]
// void claim(name owner, uint64_t lock_id);

// [[eosio::action]]
// void addlock(name sender, name owner, name tier_id, asset amount);

// [[eosio::action]]
// void removelock(uint64_t lock_id);

const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep } = require('../scripts/helper')

const { tier_vesting, hyphatoken, firstuser, seconduser, thirduser, fourthuser } = names

// typedef eosio::multi_index<"tiers"_n, tier> tiers_table;
// typedef eosio::multi_index<"locks"_n, tier> tiers_table;
// typedef eosio::multi_index<"balances"_n, tier> tiers_table;
// typedef eosio::multi_index<"tokens"_n, tier> tiers_table;

const getTiersTable = async () => {
    return eos.getTableRows({
        code: tier_vesting,
        scope: tier_vesting,
        table: 'tiers',
        json: true
    })
}

const getLocksTable = async (lockId) => {
    return eos.getTableRows({
        code: tier_vesting,
        scope: tier_vesting,
        table: 'locks',
        json: true
    })
}

const getBalancesTable = async () => {
    return eos.getTableRows({
        code: tier_vesting,
        scope: tier_vesting,
        table: 'balances',
        json: true
    })
}

const getLock = async (lockId) => {
    const rows = await eos.getTableRows({
        code: tier_vesting,
        scope: tier_vesting,
        table: 'locks',
        lower_bound: lockId,
        upper_bound: lockId,
        json: true
    })
    if (rows.length == 1) {
        return rows[0]
    } else {
        throw "lock not found: " + lockId
    }
}

const setup = async () => {

    if (!isLocal()) {
        console.log("only run unit tests on local - don't reset accounts on mainnet or testnet")
        return
    }

    console.log("init contracts")
    const contract = await eos.contract(tier_vesting)
    const tokenContract = await eos.contract(hyphatoken)

    console.log("reset contract")
    await contract.reset({ authorization: `${tier_vesting}@active` })

    console.log("add a tier")
    const tierName = "tier11"
    await contract.addtier(tierName, "0.00 HYPHA", "The first tier", { authorization: `${tier_vesting}@active` })

    const addLock = async (from, to, tier, amount) => {
        await tokenContract.transfer(from, tier_vesting, amount, "test", { authorization: `${firstuser}@active` })
        await contract.addlock(from, to, tier, amount, { authorization: `${firstuser}@active` })
    }

    const commonData = {
        contract,
        tokenContract,
        tierName,
        addLock,
    };
    await sleep(300)
    return commonData;
};

const expectError = async (func, expectedMessage) => {
    try {
        await func()
        return false
    } catch (error) {
        if (("" + error).toLowerCase().indexOf(expectedMessage.toLowerCase()) != -1) {
            // console.log("expected error " + error)
            return true
        } else {
            console.log("unexpected error: " + error)
            return false
        }
    }

}


describe('Tier Vesting', async assert => {


    describe('Add and remove tiers', async assert => {
        const { contract, tokenContract, tierName, addLock } = await setup();
        const tiers = await getTiersTable()
        //console.log("tiers " + JSON.stringify(tiers, null, 2))
        const theTier = tiers.rows[0]
        var duplicateTierName = false
        try {
            console.log("add a tier same name")
            await contract.addtier(tierName, "9.00 HYPHA", "something", { authorization: `${tier_vesting}@active` })
            duplicateTierName = true
        } catch (err) {
            console.log("expected error: " + err)
        }

        await contract.removetier(tierName, { authorization: `${tier_vesting}@active` })

        const tiersAfter2 = await getTiersTable()
        console.log("tiers after 2: " + JSON.stringify(tiersAfter2, null, 2))

        assert({
            given: 'Created Tier',
            should: 'exist',
            actual: {
                "id": theTier.id,
                "name": theTier.name,
                "total_amount": theTier.total_amount,
                "released_amount": theTier.released_amount,
            },
            expected: {
                "id": tierName,
                "name": "The first tier",
                "total_amount": "0.00 HYPHA",
                "released_amount": "0.00 HYPHA",
            }

        })

        assert({
            given: 'Trying to create tier with existing name',
            should: 'fail',
            actual: duplicateTierName,
            expected: false
        })

        assert({
            given: 'Deleted tiers',
            should: 'delete tiers',
            actual: tiersAfter2.rows.length,
            expected: 0
        })

    })

    describe('Add and remove locks', async assert => {
        const { contract, tokenContract, tierName, addLock } = await setup();

        const totalTierAmount = async () => (await getTiersTable()).rows[0].total_amount

        console.log("add locks")
        await addLock(firstuser, seconduser, tierName, "300.00 HYPHA")

        assert({
            given: 'Added lock',
            should: 'add to balance',
            actual: (await totalTierAmount()),
            expected: "300.00 HYPHA",
        })

        await addLock(firstuser, thirduser, tierName, "1000.00 HYPHA")

        assert({
            given: 'Added second lock',
            should: 'add to balance',
            actual: (await totalTierAmount()),
            expected: "1300.00 HYPHA",
        })

        await addLock(firstuser, fourthuser, tierName, "1.00 HYPHA")

        assert({
            given: 'Added third lock',
            should: 'add to balance',
            actual: (await totalTierAmount()),
            expected: "1301.00 HYPHA",
        })

        const locks = await getLocksTable()
        console.log('locks: ' + JSON.stringify(locks, null, 2))

        assert({
            given: 'Created lock',
            should: 'lock exists',
            actual: locks,
            expected: {
                "rows": [
                    {
                        "lock_id": 0,
                        "owner": seconduser,
                        "tier_id": "tier11",
                        "amount": "300.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA"
                    },
                    {
                        "lock_id": 1,
                        "owner": thirduser,
                        "tier_id": "tier11",
                        "amount": "1000.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA"
                    },
                    {
                        "lock_id": 2,
                        "owner": fourthuser,
                        "tier_id": "tier11",
                        "amount": "1.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA"
                    }
                ],
                "more": false,
                "next_key": "",
                "next_key_bytes": ""
            }

        })


    })

    describe('Check balances', async assert => {
        const { contract, tokenContract, tierName, addLock } = await setup();

        console.log("add locks")

        const addWhenNoBalanceThrowsError = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "0.01 HYPHA", { authorization: `${firstuser}@active` })
        }, "balance")

        await tokenContract.transfer(firstuser, tier_vesting, "100.00 HYPHA", "test", { authorization: `${firstuser}@active` })
        const lockTooMuchThrows = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "100.01 HYPHA", { authorization: `${firstuser}@active` })
        }, "balance")

        console.log("add lock")

        const balances = await getBalancesTable()

        console.log("balances: " + JSON.stringify(balances, null, 2))
        
        await contract.addlock(firstuser, seconduser, tierName, "99.00 HYPHA", { authorization: `${firstuser}@active` })
        
        const balancesAfter = await getBalancesTable()

        const balanceFinishedThrows = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "1.01 HYPHA", { authorization: `${firstuser}@active` })
        }, "balance")

        await contract.addlock(firstuser, seconduser, tierName, "1.00 HYPHA", { authorization: `${firstuser}@active` })
        const balancesAfter2 = await getBalancesTable()


        assert({
            given: 'No balance',
            should: 'throw error',
            actual: addWhenNoBalanceThrowsError,
            expected: true,
        })
        assert({
            given: 'Not enough balance',
            should: 'throw error',
            actual: lockTooMuchThrows,
            expected: true,
        })
        assert({
            given: 'Not enough balance 2',
            should: 'throw error',
            actual: balanceFinishedThrows,
            expected: true,
        })

        assert({
            given: 'Transferred balance',
            should: 'shows balance',
            actual: balances.rows,
            expected: [
                {
                  "owner": firstuser,
                  "balance": "100.00 HYPHA"
                }
              ],
        })
        assert({
            given: 'Used up some of the balance',
            should: 'shows remaining balance',
            actual: balancesAfter.rows,
            expected: [
                {
                  "owner": firstuser,
                  "balance": "1.00 HYPHA"
                }
              ]
            ,
        })
        assert({
            given: 'Used up balance',
            should: 'shows 0 remaining',
            actual: balancesAfter2.rows,
            expected: [
                {
                  "owner": firstuser,
                  "balance": "0.00 HYPHA"
                }
              ]
            ,
        })


    })

    describe.only('Release and claim', async assert => {
        const { contract, tokenContract, tierName, addLock } = await setup();

        console.log("transfer balance")

        await tokenContract.transfer("owner", firstuser, "9100.00 HYPHA", "issue tokens", { authorization: `owner@active` })

        await tokenContract.transfer(firstuser, tier_vesting, "9100.00 HYPHA", "test", { authorization: `${firstuser}@active` })

        console.log("add locks")
        const lockedValues = [
            1000,
            3000,
            5000,
            100
        ]
        await contract.addlock(firstuser, seconduser, tierName, "1000.00 HYPHA", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, thirduser, tierName, "3000.00 HYPHA", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, fourthuser, tierName, "5000.00 HYPHA", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, seconduser, tierName, "100.00 HYPHA", { authorization: `${firstuser}@active` })

        const locks = await getLocksTable()
        console.log('locks: ' + JSON.stringify(locks, null, 2))

        // console.log('tiers: ' + JSON.stringify((await getTiersTable()), null, 2))

        const releaseWrongSymbolThrows = await expectError(async()=>{
            await contract.release(tierName, "910.00 EOS", { authorization: `${tier_vesting}@active` })
        }, "symbol")
        const releaseWrongPrecisionThrows = await expectError(async()=>{
            await contract.release(tierName, "910.0000 HYPHA", { authorization: `${tier_vesting}@active` })
        }, "symbol")
        //console.log('tiers after: ' + JSON.stringify((await getTiersTable()), null, 2))
        await contract.release(tierName, "910.00 HYPHA", { authorization: `${tier_vesting}@active` })
        // console.log('tiers after 2: ' + JSON.stringify((await getTiersTable()), null, 2))
        
        const getBalance = async (account) => {
            return await eos.getCurrencyBalance("hypha.hypha", account, "HYPHA")
        }

        const claimWithExpectedDifference = async (account, lock_id, expectedClaim) => {
            const balance = parseFloat(await getBalance(account))
            console.log("account " + account + " has " + balance + " HYPHA " + " expected claim: " + expectedClaim)
            
            await contract.claim(account, lock_id, { authorization: `${account}@active` })

            const balanceAfter = parseFloat(await getBalance(account))
            console.log("account " + account + " balance after: " + balanceAfter + " HYPHA")
            const expected = parseFloat(expectedClaim)
            const difference = balanceAfter - balance

            console.log("claimed " + difference + " HYPHA")

            const epsilon = Math.abs(difference - expected)
            console.log("epsilon " + epsilon + "")

            assert({
                given: 'Expected claim - user ' + account + ' lock ' + lock_id + ' of ' + expectedClaim ,
                should: 'Claim the expected amount',
                actual: epsilon < 0.0001,
                expected: true,
            })
                
            
        }

        const tier = (await getTiersTable()).rows[0]

        // void claim(name owner, uint64_t lock_id);
        console.log("claim some")

        const expectedClaim = (id) => (lockedValues[id] * 0.1).toFixed(2) + " HYPHA"

        await claimWithExpectedDifference(seconduser, 0, expectedClaim(0))

        const claimTheWrongLock = await expectError(async()=>{
            await contract.claim(seconduser, 1, { authorization: `${seconduser}@active` })
        }, "Only owner")


        assert({
            given: 'Release wrong symbol',
            should: 'throw error',
            actual: releaseWrongSymbolThrows,
            expected: true,
        })

        assert({
            given: 'Release wrong symbol',
            should: 'throw error',
            actual: releaseWrongPrecisionThrows,
            expected: true,
        })

        assert({
            given: 'Release 10%',
            should: 'show correct values',
            actual: {
                "released_amount": tier.released_amount,
                "percentage_released": parseFloat(tier.percentage_released).toFixed(2)
            },
            expected: {
                "released_amount": "910.00 HYPHA",
                "percentage_released": "10.00"        
            },
        })
        assert({
            given: 'Claim wrong lock',
            should: 'throw error',
            actual: claimTheWrongLock,
            expected: true,
        })

    })


})

