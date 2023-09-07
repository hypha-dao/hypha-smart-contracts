const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep } = require('../scripts/helper')

const { tier_vesting, hyphatoken, firstuser, seconduser, thirduser, fourthuser } = names

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
    const res = await eos.getTableRows({
        code: tier_vesting,
        scope: tier_vesting,
        table: 'locks',
        lower_bound: lockId,
        upper_bound: lockId,
        json: true
    })
    if (res.rows.length == 1) {
        return res.rows[0]
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
        await tokenContract.transfer("owner", firstuser, amount, "", { authorization: `owner@active` })
        await tokenContract.transfer(from, tier_vesting, amount, "test", { authorization: `${firstuser}@active` })
        await contract.addlock(from, to, tier, amount, "", { authorization: `${firstuser}@active` })
    }

    const commonData = {
        contract,
        tokenContract,
        tierName,
        addLock,
    };

    await sleep(500)
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
        // console.log('locks: ' + JSON.stringify(locks, null, 2))

        assert({
            given: 'Created lock',
            should: 'lock exists',
            actual: locks.rows,
            expected: [
                    {
                        "lock_id": 0,
                        "owner": seconduser,
                        "tier_id": "tier11",
                        "amount": "300.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA",
                        "note": "",
                    },
                    {
                        "lock_id": 1,
                        "owner": thirduser,
                        "tier_id": "tier11",
                        "amount": "1000.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA",
                        "note": "",
                    },
                    {
                        "lock_id": 2,
                        "owner": fourthuser,
                        "tier_id": "tier11",
                        "amount": "1.00 HYPHA",
                        "claimed_amount": "0.00 HYPHA",
                        "note": "",
                    }
                ]
        })


    })

    describe('Check balances', async assert => {
        const { contract, tokenContract, tierName, addLock } = await setup();


        const addWhenNoBalanceThrowsError = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "0.01 HYPHA", "", { authorization: `${firstuser}@active` })
        }, "balance")

        console.log("send balance")
        await tokenContract.transfer("owner", firstuser, "100.00 HYPHA", "", { authorization: `owner@active` })
        await tokenContract.transfer(firstuser, tier_vesting, "100.00 HYPHA", "test", { authorization: `${firstuser}@active` })

        const lockTooMuchThrows = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "100.01 HYPHA", "a note", { authorization: `${firstuser}@active` })
        }, "balance")

        console.log("add lock")

        const balances = await getBalancesTable()

        // console.log("balances: " + JSON.stringify(balances, null, 2))
        
        await contract.addlock(firstuser, seconduser, tierName, "99.00 HYPHA", "test note", { authorization: `${firstuser}@active` })
        
        const balancesAfter = await getBalancesTable()

        const balanceFinishedThrows = await expectError(async ()=>{
            await contract.addlock(firstuser, seconduser, tierName, "1.01 HYPHA", "note note", { authorization: `${firstuser}@active` })
        }, "balance")

        await contract.addlock(firstuser, seconduser, tierName, "1.00 HYPHA", "notify this", { authorization: `${firstuser}@active` })
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

    describe('Release and claim', async assert => {
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
        await contract.addlock(firstuser, seconduser, tierName, "1000.00 HYPHA", "", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, thirduser, tierName, "3000.00 HYPHA", "", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, fourthuser, tierName, "5000.00 HYPHA", "", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, seconduser, tierName, "100.00 HYPHA", "", { authorization: `${firstuser}@active` })

        const locks = await getLocksTable()
        // console.log('locks: ' + JSON.stringify(locks, null, 2))

        // console.log('tiers: ' + JSON.stringify((await getTiersTable()), null, 2))

        const releaseWrongSymbolThrows = await expectError(async()=>{
            await contract.release(tierName, "910.00 EOS", { authorization: `${tier_vesting}@active` })
        }, "symbol")
        const releaseWrongPrecisionThrows = await expectError(async()=>{
            await contract.release(tierName, "910.0000 HYPHA", { authorization: `${tier_vesting}@active` })
        }, "symbol")

        /// release 10%
        console.log("release 10% of tier")
        await contract.release(tierName, "910.00 HYPHA", { authorization: `${tier_vesting}@active` })

        const tier = (await getTiersTable()).rows[0]
        
        const addLockOnActiveTierThrows = await expectError(async()=>{
            await contract.addlock(firstuser, seconduser, tierName, "1.00 HYPHA", "", { authorization: `${firstuser}@active` })
        }, "vesting has already started")


        const getBalance = async (account) => {
            return await eos.getCurrencyBalance("hypha.hypha", account, "HYPHA")
        }

        const claimWithExpectedDifference = async (account, lock_id, expectedClaim) => {
            const balance = parseFloat(await getBalance(account))
            console.log("account " + account + " has " + balance + " HYPHA " + " expected claim: " + expectedClaim)
            
            const lockBefore = await getLock(lock_id)

            await contract.claim(account, lock_id, { authorization: `${account}@active` })

            const balanceAfter = parseFloat(await getBalance(account))
            const lockAfter = await getLock(lock_id)

            console.log("account " + account + " balance after: " + balanceAfter + " HYPHA")
            const expected = parseFloat(expectedClaim)
            const difference = balanceAfter - balance

            console.log("claimed " + difference + " HYPHA")

            const epsilon = Math.abs(difference - expected)

            assert({
                given: 'Expected claim - user ' + account + ' lock ' + lock_id + ' of ' + expectedClaim + " epsilon: " + epsilon ,
                should: 'Claim the expected amount',
                actual: parseFloat((epsilon * 100).toFixed(2)) <= 1,
                expected: true,
            })

            const lockClaimBefore = parseFloat(lockBefore.claimed_amount)
            const expectedAfter = lockClaimBefore + difference
            const lockClaimAfter = parseFloat(lockAfter.claimed_amount)
            const claimEpsilon = Math.abs(lockClaimAfter - expectedAfter)

            assert({
                given: 'Claim of ' + difference  + " claim eps: " + claimEpsilon,
                should: 'Modify lock claimed balance',
                actual: parseFloat((claimEpsilon * 100).toFixed(2)) <= 1,
                expected: true,
            })

        }
        console.log("claim some")
        const expectedClaim = (id) => (lockedValues[id] * 0.1).toFixed(2) + " HYPHA"

        await claimWithExpectedDifference(seconduser, 0, expectedClaim(0))

        const claimTheWrongLock = await expectError(async()=>{
            await contract.claim(seconduser, 1, { authorization: `${seconduser}@active` })
        }, "Only owner")

        await claimWithExpectedDifference(thirduser, 1, expectedClaim(1))
        await claimWithExpectedDifference(fourthuser, 2, expectedClaim(2))
        await claimWithExpectedDifference(seconduser, 3, expectedClaim(3))

        const claimNothingThrows = await expectError(async()=>{
            await sleep(500) // this keeps throwing duplicate transaction.
            await contract.claim(seconduser, 0, { authorization: `${seconduser}@active` })
        }, "nothing")
        const lockDoesNotExistThrows = await expectError(async()=>{
            await sleep(500) // this keeps throwing duplicate transaction.
            await contract.claim(firstuser, 8, { authorization: `${firstuser}@active` })
        }, "lock")

        console.log("release more 5%")
        await contract.release(tierName, "455.00 HYPHA", { authorization: `${tier_vesting}@active` })
        const tier2 = (await getTiersTable()).rows[0]
        await sleep(500)

        const expectedClaim5Pct = (id) => (lockedValues[id] * 0.05).toFixed(2) + " HYPHA"
        await claimWithExpectedDifference(seconduser, 0, expectedClaim5Pct(0))
        await claimWithExpectedDifference(thirduser, 1, expectedClaim5Pct(1))
        await claimWithExpectedDifference(fourthuser, 2, expectedClaim5Pct(2))
        await claimWithExpectedDifference(seconduser, 3, expectedClaim5Pct(3))

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
            given: 'Add lock after tier has started',
            should: 'throw error',
            actual: addLockOnActiveTierThrows,
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

        assert({
            given: 'Claim on nothing claimable',
            should: 'throw error',
            actual: claimNothingThrows,
            expected: true,
        })
        assert({
            given: 'Claim on non existent lock',
            should: 'throw error',
            actual: lockDoesNotExistThrows,
            expected: true,
        })

        console.log("release the rest")
        await contract.release(tierName, (9100.0 * .85).toFixed(2) + " HYPHA", { authorization: `${tier_vesting}@active` })
        const tier3 = (await getTiersTable()).rows[0]

        await sleep(500)

        const expectedClaim85Pct = (id) => (lockedValues[id] * 0.85).toFixed(2) + " HYPHA"
        await claimWithExpectedDifference(seconduser, 0, expectedClaim85Pct(0))
        await claimWithExpectedDifference(thirduser, 1, expectedClaim85Pct(1))
        await claimWithExpectedDifference(fourthuser, 2, expectedClaim85Pct(2))
        await claimWithExpectedDifference(seconduser, 3, expectedClaim85Pct(3))

        const locksAfter = await getLocksTable()
        const tierAfter = (await getTiersTable()).rows[0]

        //console.log("locks after " + JSON.stringify(locksAfter, null, 2))
        
        locksAfter.rows.forEach((element) => assert({
            given: 'claimed whole amount',
            should: 'have same claimed as amount',
            actual: element.amount == element.claimed_amount,
            expected: true,
        }))

        assert({
            given: 'Tier fully released',
            should: 'have same claimed as amount',
            actual: tierAfter.total_amount == tierAfter.released_amount,
            expected: true,
        })
        assert({
            given: 'Tier fully released',
            should: 'have 100%',
            actual: parseFloat(tierAfter.percentage_released).toFixed(4) == "100.0000",
            expected: true,
        })

    })

    describe('Tier Vesting with 2 Tiers', async assert => {
        const { contract, tierName, tokenContract, addLock } = await setup();
        
        await tokenContract.transfer("owner", firstuser, "35.00 HYPHA", "issue tokens", { authorization: `owner@active` })

        const tier2 = "tier22";
                
        console.log("add tier2")

        await contract.addtier(tier2, "0.00 HYPHA", "The second tier", { authorization: `${tier_vesting}@active` });
    
        console.log("add locks")
        // Add locks to both tiers
        await addLock(firstuser, seconduser, tierName, "5.00 HYPHA");
        await addLock(firstuser, thirduser, tierName, "10.00 HYPHA");
        await addLock(firstuser, fourthuser, tier2, "20.00 HYPHA");
    
        // ... Continue with assertions for adding locks
    
        console.log("release tier 1")
        await contract.release(tierName, "15.00 HYPHA", { authorization: `${tier_vesting}@active` });
    
        // ... Continue with assertions for releasing tier 1
    
        console.log("claim from tier 1")
        // Claim from tier 1 locks
        await contract.claim(seconduser, 0, { authorization: `${seconduser}@active` });
        await contract.claim(thirduser, 1, { authorization: `${thirduser}@active` });
    
        // ... Continue with assertions for claiming from tier 1
    
        console.log("attempt to claim from tier 2")
        const tier2ClaimThrows = await expectError(async () => {
            await contract.claim(fourthuser, 2, { authorization: `${fourthuser}@active` });
        }, "Nothing to claim");
    
        assert({
            given: 'Added two tiers',
            should: 'exist',
            actual: (await getTiersTable()).rows.length,
            expected: 2,
        });
    
        assert({
            given: 'Attempt to claim from tier 2',
            should: 'throw error',
            actual: tier2ClaimThrows,
            expected: true,
        });
    
    });
        

})

