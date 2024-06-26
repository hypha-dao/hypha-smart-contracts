const assert = require('assert')
const zlib = require('zlib')
const fetch = require('node-fetch')

const eosjs = require('eosjs')
const { Serialize } = eosjs
const { SigningRequest } = require('eosio-signing-request')
const { source } = require('./deploy')
const { accounts, eos } = require('./helper')
const createEsrWithActions = require('./helpers/createEsrWithActions')

const authPlaceholder = "............1"

const transferAction = (beneficiary, amount) => {

  return  {
    "account": "hypha.hypha",
    "name": "transfer",
    "authorization": [{
        "actor": "dao.hypha",
        "permission": "active"
      }
    ],
    "data": {
      "from": "dao.hypha",
      "to": beneficiary,
      "quantity": amount.toFixed(2) + " HYPHA",
      "memo": "Migrate balances"
    },
  }

}

// key: hypha_token_contract
// value: ["name", "hypha.hypha"]
const setSettingsAction = (setting, value) => {
  return  {
    "account": "dao.hypha",
    "name": "setsetting",
    "authorization": [{
        "actor": "dao.hypha",
        "permission": "active"
      }
    ],
    "data": {
      "key": "hypha_token_contract",
      "value": ["name", "hypha.hypha"],
    },
  }
}


const issueAction = (amount) => {

  return  {
    "account": "hypha.hypha",
    "name": "issue",
    "authorization": [{
        "actor": "dao.hypha",
        "permission": "active"
      }
    ],
    "data": {
      "to": "dao.hypha",
      "quantity": amount.toFixed(2) + " HYPHA",
      "memo": "Migrate balances to hypha.hypha"
    },
  }

}

// expects a list of { account: accountName, amount: N}, N is a number
const migrateTokens = async (list, propname) => {
  var total = 0

  list = list.filter((item) => item.amount > 0)

  for (item of list) {
    console.log("item: " + JSON.stringify(item, null, 2))

    total += parseInt (  (parseFloat( item.amount.toFixed(2) ) * 100) + "" )
  }

  total = total / 100.0

  actions = []

  // issue
  actions.push(issueAction(total))

  for (item of list) {
    actions.push(transferAction(item.account, item.amount))
  }

  console.log("actions: " + JSON.stringify(actions, null, 2))

  proposeMsig("illumination", propname, "dao.hypha", actions)

}

const proposeMsig = async (proposerAccount, proposalName, contract, actions, permission = "active") => {

  const proposeESR = await createMultisigPropose(proposerAccount, proposalName, contract, actions, permission)

  console.log("ESR for Propose: " + JSON.stringify(proposeESR, null, 2))

  // https://explorer.telos.net/proposal/irr4ee // weird - no proposer??
  // url: `https://mongo.hypha.earth/multisig/${proposerAccount}/${proposalName}`

  const url = `https://mongo.hypha.earth/multisig/${proposerAccount}/${proposalName}`

  console.log("Proposal URL: " + url)

  const approveESR = await createESRCodeApprove({proposerAccount, proposalName})

  console.log("ESR for Approve: " + JSON.stringify(approveESR, null, 2))

  const execESR = await createESRCodeExec({proposerAccount, proposalName})

  console.log("ESR for Exec: " + JSON.stringify(execESR, null, 2))

  const cancelESR = await createESRCodeCancel({proposerAccount, proposalName})

  console.log("ESR for Cancel: " + JSON.stringify(cancelESR, null, 2))

  return proposeESR
}

const getConstitutionalGuardians = async (permission_name = "active") => {
  const guardacct = "cg.seeds"
  const { permissions } = await eos.getAccount(guardacct)
  const activePerm = permissions.filter(item => item.perm_name == permission_name)
  const result = activePerm[0].required_auth.accounts
    .filter(item => item.permission.actor != "msig.seeds")
    .map(item => item.permission)
  console.log("CG accounts: "+permission_name+ ": "+JSON.stringify(result, null, 2))
  return result
}

const getApprovers = async (account, permission_name = "active") => {
  const { permissions } = await eos.getAccount(account)
  // console.log("perm " + JSON.stringify(activePerm, null, 2))

  const activePerm = permissions.filter(item => item.perm_name == permission_name)

// console.log("active " + JSON.stringify(activePerm, null, 2))

  const result = activePerm[0].required_auth.accounts
    .filter(item => item.permission.actor != account)
    .map(item => item.permission)
  console.log(`Approve accounts on ${account}: ${JSON.stringify(result, null, 2)}`)
  return result
}

// take any input of actions, create a multisig proposal for guardians from it!

const createMultisigPropose = async (proposerAccount, proposalName, contract, actions, permission = "active") => {

    const api = eos.api

    const serializedActions = await api.serializeActions(actions)
  
    requestedApprovals = await getApprovers(contract, permission)

    //requestedApprovals = await getConstitutionalGuardians(permission)

    console.log("====== PROPOSING ======")
    
    console.log("requested permissions: "+permission+ " " + JSON.stringify(requestedApprovals))
  
    const info = await api.rpc.get_info();
    const head_block = await api.rpc.get_block(info.last_irreversible_block_num);
    const chainId = info.chain_id;

    const expiration = Serialize.timePointSecToDate(Serialize.dateToTimePointSec(head_block.timestamp) + 3600 * 24 * 7)

    const proposeInput = {
      proposer: proposerAccount,
      proposal_name: proposalName,
      requested: requestedApprovals,
      trx: {
        expiration: expiration,
        ref_block_num: 0,
        ref_block_prefix: 0,
        max_net_usage_words: 0,
        max_cpu_usage_ms: 0,
        delay_sec: 0,
        context_free_actions: [],
        actions: serializedActions,
        transaction_extensions: []
      }
    };
    
    const auth = [{
      actor: proposerAccount,
      permission: "active",
    }]
  
    const propActions = [{
      account: 'eosio.msig',
      name: 'propose',
      authorization: auth,
      data: proposeInput
    }]
    
    return createEsrWithActions({actions: propActions})

}

const createESRCodeApprove = async ({proposerAccount, proposalName}) => {

  const approveActions = [{
    account: 'eosio.msig',
    name: 'approve',
    data: {
      proposer: proposerAccount,
      proposal_name: proposalName,
      level: {
        actor: authPlaceholder,
        permission: 'active'
      }
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createEsrWithActions({actions: approveActions})
}

const createESRCodeExec = async ({proposerAccount, proposalName}) => {

  const execActions = [{
    account: 'eosio.msig',
    name: 'exec',
    data: {
      proposer: proposerAccount,
      proposal_name: proposalName,
      executer: authPlaceholder
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createEsrWithActions({actions: execActions})
}

const createESRCodeCancel = async ({proposerAccount, proposalName}) => {

  const execActions = [{
    account: 'eosio.msig',
    name: 'cancel',
    data: {
      proposer: proposerAccount,
      proposal_name: proposalName,
      canceler: authPlaceholder
    },
    authorization: [{
      actor: authPlaceholder,
      permission: 'active'
    }]
  }]

  return createEsrWithActions({actions: execActions})
}


module.exports = { proposeMsig, migrateTokens, setSettingsAction }
