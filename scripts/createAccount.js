const { eos } = require('./helper')

const createAccount = async ({ account, publicKey, stakes, creator }) => {

    try {

        await eos.transaction({
            actions: [
                {
                    account: 'eosio',
                    name: 'newaccount',
                    authorization: [{
                        actor: creator,
                        permission: 'active',
                    }],
                    data: {
                        creator,
                        name: account,
                        owner: {
                            threshold: 1,
                            keys: [{
                                key: publicKey,
                                weight: 1
                            }],
                            accounts: [],
                            waits: []
                        },
                        active: {
                            threshold: 1,
                            keys: [{
                                key: publicKey,
                                weight: 1
                            }],
                            accounts: [],
                            waits: []
                        },
                    }
                }
            ]
        })

        try {
            await eos.transaction({
                actions: [
                    {
                        account: 'eosio',
                        name: 'buyrambytes',
                        authorization: [{
                            actor: creator,
                            permission: 'active',
                        }],
                        data: {
                            payer: creator,
                            receiver: account,
                            bytes: stakes.ram,
                        },
                    },
                    {
                        account: 'eosio',
                        name: 'delegatebw',
                        authorization: [{
                            actor: creator,
                            permission: 'active',
                        }],
                        data: {
                            from: creator,
                            receiver: account,
                            stake_net_quantity: stakes.net,
                            stake_cpu_quantity: stakes.cpu,
                            transfer: false,
                        }
                    }
                ]
            })
        } catch (error) {
            console.error("unknown delegatebw action " + error)
        }

        console.log(`${account} created`)
    } catch (err) {
        if (("" + err).indexOf("as that name is already taken") != -1) {
            console.error(`account ${account} already created`)
        } else {
            console.error(`account ${account} create error ` + err)
            throw err
        }
    }
}

module.exports = createAccount