const { httpEndpoint } = require("../helper")
const execCleos = require("./execCleos")

module.exports = async function updateauth({ account, permission, parent, auth }, { authorization }) {
    let [actor, perm] = authorization.split('@')

    if ((parent === 'owner' && permission === 'owner') || parent === '') {
      parent = '.'
    }

    if (auth.accounts) {
      auth.accounts.sort((a, b) => {
        if (a.permission.actor <= b.permission.actor) {
          return -1
        }
        return 1
      })
    }

    const action = {
        account: 'eosio',
        name: 'updateauth',
        authorization: [{
          actor,
          permission: perm,
        }],
        data: {
          account,
          permission,
          parent,
          auth
        },
    }

    await execCleos([action], httpEndpoint)
}