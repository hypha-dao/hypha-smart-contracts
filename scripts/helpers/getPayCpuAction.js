const { names } = require('../helper')
const { paycpu } = names


const getPayCpuAction = async (account) => {  
    return {
        account: paycpu,
        name: 'payforcpu',
        authorization: [
            { actor: paycpu, permission: 'payforcpu' },  // Authorize the contract
            { actor: account, permission: 'active' },    // Authorize the target account
        ],
        data: {
            account: account,
        },
    }
}

module.exports = getPayCpuAction
