
// [[eosio::action]]
// void addtier(name tier_id, asset total_amount, time_point_sec created_at, std::string name);

// [[eosio::action]]
// void removetier(name tier_id);

// [[eosio::action]]
// void release(name tier_id, double percent);

// [[eosio::action]]
// void claim(name owner, uint64_t lock_id);

// [[eosio::action]]
// void addlock(name sender, name owner, name tier_id, asset amount);

// [[eosio::action]]
// void removelock(uint64_t lock_id);

// [[eosio::action]]
// void addtoken(name token_contract, asset token);

// [[eosio::action]]
// void removetoken(symbol token_symbol);

// [[eosio::on_notify("hypha.hypha::transfer")]]
// void onreceive(name from, name to, asset quantity, std::string memo);

const { describe } = require('riteway')
const { eos, names, getTableRows, initContracts, sha256, fromHexString, isLocal, ramdom64ByteHexString, createKeypair, getBalance, sleep } = require('../scripts/helper')

const { tier_vesting, hyphatoken, firstuser, seconduser, thirduser } = names

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

describe('Tier Vesting', async assert => {

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

    await contract.addtier(tierName, "10000.00 HYPHA", "The first tier", { authorization: `${tier_vesting}@active` })

    const tiers = await getTiersTable()
    //console.log("tiers " + JSON.stringify(tiers, null, 2))

    const theTier = tiers.rows[0]

    console.log("add locks")
    const addLock = async (from, to, tier, amount) => {
        await tokenContract.transfer(firstuser, tier_vesting, "300.00 HYPHA", "test", { authorization: `${firstuser}@active` })
        await contract.addlock(firstuser, seconduser, tierName, "300.00 HYPHA", { authorization: `${firstuser}@active` })
    }

    await addLock(firstuser, seconduser, tierName, "300.00 HYPHA")

    //void addlock(name sender, name owner, name tier_id, asset amount);

// void release(name tier_id, amount);
    console.log("release a percentage")
    await contract.release(tierName, "300.00 HYPHA", { authorization: `${tier_vesting}@active` })


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


