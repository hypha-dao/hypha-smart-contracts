const fs = require('fs')
const path = require('path')
const R = require('ramda')
const { eos, isLocal, getBalance, accounts, contractPermissions, sleep, httpEndpoint } = require('./helper')
const createAccount = require('./createAccount')
const linkAuthAction = require('./actions/linkAuthAction')
const execCleos = require('./helpers/execCleos')
const execUpdateAuth = require('./helpers/execUpdateAuth')

const debug = process.env.DEBUG || false

console.print = ((showMessage) => {
  return (msg) => {
    showMessage(msg)
  }
})(console.log)

console.log = ((showMessage) => {
  return (msg) => {
    showMessage('+ ', msg)
  }
})(console.log)



console.error = ((showMessage) => {
  return (msg, err) => {
    if (process.env.DEBUG === 'true' && err) {
      showMessage('- ', msg, err)
    } else {
      showMessage('- ', msg)
    }
  }
})(console.error)

const source = async (name) => {
  const codePath = path.join(__dirname, '../artifacts', name.concat('.wasm'))
  const abiPath = path.join(__dirname, '../artifacts', name.concat('.abi'))

  const code = new Promise(resolve => {
    fs.readFile(codePath, (_, r) => resolve(r))
  })
  const abi = new Promise(resolve => {
    fs.readFile(abiPath, (_, r) => resolve(r))
  })

  return Promise.all([code, abi]).then(([code, abi]) => ({ code, abi }))
}


const deploy = async ({ name, account }) => {
  console.log("warn: deploy.js DEPLOY - duplicate code")

  try {
    const { code, abi } = await source(name)

    if (!code)
      throw new Error('code not found')

    if (!abi)
      throw new Error('abi not found')

    await eos.setcode({
      account,
      code,
      vmtype: 0,
      vmversion: 0
    }, {
      authorization: `${account}@active`
    })

    await eos.setabi({
      account,
      abi: JSON.parse(abi)
    }, {
      authorization: `${account}@active`
    })
    console.log(`${name} deployed to ${account}`)
  } catch (err) {
    let errStr = "" + err
    if (errStr.toLowerCase().includes("contract is already running this version")) {
      console.log(`${name} deployed to ${account} already`)
    } else {
      console.error(`error deploying account ${name} \n* error: ` + err + `\n`)
    }
  }
}

const createKeyPermission = async (account, role, parentRole = 'active', key) => {
  try {
    const { permissions } = await eos.getAccount(account)

    const perm = permissions.find(p => p.perm_name === role)

    if (perm) {
      const { parent, required_auth } = perm
      const { keys } = required_auth
  
      if (keys.find(item => item.key === key)) {
        console.log("- createKeyPermission key already exists "+key)
        return;
      }  
    }

    await eos.updateauth({
      account,
      permission: role,
      parent: parentRole,
      auth: {
        threshold: 1,
        waits: [],
        accounts: [],
        keys: [{
          key,
          weight: 1
        }]
      }
    }, { authorization: `${account}@owner` })
    console.log(`permission setup on ${account}@${role}(/${parentRole}) for ${key}`)
  } catch (err) {
    console.error(`failed permission setup\n* error: ` + err + `\n`)
  }
}

const createActorPermission = async (account, role, parentRole = 'active', actor, actorRole='eosio.code') => {
  try {
    const { permissions } = await eos.getAccount(account)

    const thePermission = permissions.find(p => p.perm_name === role)

    if (thePermission) {
      const { parent, required_auth } = thePermission
      const { accounts } = required_auth
  
      if (accounts.find(item => item.actor === actor && item.permission == actorRole)) {
        console.log("- createActorPermission already exists "+actor+"@"+actorRole)
        return;
      }  
    }

    await eos.updateauth({
      account,
      permission: role,
      parent: parentRole,
      auth: {
        threshold: 1,
        waits: [],
        accounts: [
          {
            permission: {
              actor,
              permission: actorRole
            },
            weight: 1
          }
        ],
        keys: []
      }
    }, { authorization: `${account}@owner` })
    console.log(`permission setup on ${account}@${role}(/${parentRole}) for ${actor+"@"+actorRole}`)
  } catch (err) {
    console.error(`failed permission setup\n* error: ` + err + `\n`)
  }
}



const allowAction = async (account, role, action) => {
  try {
    const act = linkAuthAction({
        account,
        code: account,
        type: action,
        requirement: role
      }, { actor: `${account}`, permission: "owner" })
    
      await execCleos([act], httpEndpoint)

    // await eos.linkauth({
    //   account,
    //   code: account,
    //   type: action,
    //   requirement: role
    // }, { authorization: `${account}@owner` })
    console.log(`linkauth of ${account}@${action} for ${role}`)
  } catch (err) {
    let errString = `failed allow action\n* error: ` + err + `\n`
    if (errString.includes("Attempting to update required authority, but new requirement is same as old")) {
      console.log(`- linkauth of ${account}@${action} for ${role} exists`)
    } else {
      console.error(errString)
    }
  }
}

const addActorPermission = async (target, targetRole, actor, actorRole) => {
  console.log("addActorPermission")
  try {
    const { parent, required_auth: { threshold, waits, keys, accounts } } =
      (await eos.getAccount(target))
        .permissions.find(p => p.perm_name == targetRole)

    const existingPermission = accounts.find(({ permission }) =>
      permission.actor == actor && permission.permission == actorRole
    )

    if (existingPermission)
      return console.error(`- permission ${actor}@${actorRole} already exists for ${target}@${targetRole}`)

    const permissions = {
      account: target,
      permission: targetRole,
      parent,
      auth: {
        threshold,
        waits,
        accounts: [
          ...accounts,
          {
            permission: {
              actor,
              permission: actorRole
            },
            weight: 1
          }
        ],
        keys: [
          ...keys
        ]
      }
    }
    await execUpdateAuth(permissions, { authorization: `${target}@owner` })
    // await eos.updateauth(permissions, { authorization: `${target}@owner` })
    console.log(`+ permission created on ${target}@${targetRole} for ${actor}@${actorRole}`)
  } catch (err) {
    console.error(`failed permission update on ${target} for ${actor}\n* error: ` + err + `\n`)
  }
}

const removeAllActorPermissions = async (target) => {
  await removeActorPermission(target, "active")
  await removeActorPermission(target, "owner")
}

const removeActorPermission = async (target, targetRole) => {
  console.log("remove "+target + "@" + targetRole)
  try {
    const { parent, required_auth: { threshold, waits, keys, accounts } } =
      (await eos.getAccount(target))
        .permissions.find(p => p.perm_name == targetRole)

    const permissions = {
      account: target,
      permission: targetRole,
      parent,
      auth: {
        threshold,
        waits,
        accounts: [],
        keys: [
          ...keys
        ]
      }
    }

    await eos.updateauth(permissions, { authorization: `${target}@owner` })
    console.log(`+ actor permissions removed on ${target}@${targetRole}`)
  } catch (err) {
    console.error(`failed permission update on ${target}\n* error: ` + err + `\n`)
  }
}

const changeOwnerAndActivePermission = async (account, key) => {
  await changeExistingKeyPermission(account, "active", "owner", key)
  await changeExistingKeyPermission(account, "execute", "active", key)
  await changeExistingKeyPermission(account, "owner", "", key)
}

const changeExistingKeyPermission = async (account, role, parentRole = 'active', key) => {
  try {
    const { permissions } = await eos.getAccount(account)

    //console.log(account + " permissions: "+ JSON.stringify(permissions, null, 2))

    const perm = permissions.find(p => p.perm_name === role)

    if (!perm) {
      console.error(`permission not found : ` + role + `\n`)
      return
    }
    const { required_auth } = perm
    const { keys, accounts, waits } = required_auth
  
    if (keys.find(item => item.key === key)) {
      console.log("- createKeyPermission key already exists "+key)
      return;
    }  
    
    await eos.updateauth({
      account,
      permission: role,
      parent: parentRole,
      auth: {
        threshold: 1,
        waits: waits,
        accounts: accounts,
        keys: [{
          key,
          weight: 1
        }]
      }
    }, { authorization: `${account}@owner` })

    //const afterAcct = await eos.getAccount(account)
    //console.log(account + "=== AFTER permissions: "+ JSON.stringify(afterAcct.permissions, null, 2))

    console.log(`permission setup on ${account}@${role}(/${parentRole}) for ${key}`)
  } catch (err) {
    console.error(`failed permission setup\n* error: ` + err + `\n`)
  }
}

const keys = (perm) => {
  return perm.required_auth.keys.map((item) => item.key)
}
const pAccounts = (perm) => {
  return perm.required_auth.accounts.map((item)=>item.permission.actor)
}
const listPermissions = async (account) => {
  try {
    const { permissions } = await eos.getAccount(account)

    const ownerPermissions = permissions.find(p => p.perm_name === "owner")
    const activePermissions = permissions.find(p => p.perm_name === "active")
    
    const ownerStr = keys(ownerPermissions) + " | " + pAccounts(ownerPermissions)
    const activerStr = keys(activePermissions) + " | " + pAccounts(activePermissions)

    console.log(account + " owner: "+ JSON.stringify(ownerStr, null, 2))
    console.log(account + " active: "+ JSON.stringify(activerStr, null, 2))
  } catch (err) {
    const accountDoesNotExist = (err + "").startsWith("Error: unknown key (boost::tuples::tuple")
    if (!accountDoesNotExist) {
      console.error(`listPermissions error: ${account}: ` + err + `\n`)
    } else {
      console.log("account does not exist: "+account)
    }
  }
}

const createCoins = async (token) => {
  const { account, issuer, supply } = token

  try {
    await eos.transaction({
      actions: [
        {
          account,
          name: 'create',
          authorization: [{
            actor: account,
            permission: 'active'
          }],
          data: {
            issuer,
            initial_supply: supply,
            max_supply: supply,
          }
        }
      ]
    })
  
    await eos.transaction({
      actions: [
        {
          account,
          name: 'issue',
          authorization: [{
            actor: issuer,
            permission: 'active'
          }],
          data: {
            to: issuer,
            quantity: supply,
            memo: ''
          }
        }
      ]
    })
    console.log(`coins successfully minted at ${account} with max supply of ${supply}`)
  } catch (err) {
    console.error(`coins already created at ${account}\n* error: ` + err + "\n")
  }
}

const transferCoins = async (token, recipient) => {
  try {

    await eos.transaction({
      actions: [
        {
          account: token.account,
          name: 'transfer',
          authorization: [{
            actor: token.issuer,
            permission: 'active'
          }],
          data: {
            from: token.issuer,
            to: recipient.account,
            quantity: recipient.quantity,
            memo: ''
          }
        }
      ]
    })
    
    console.log(`sent ${recipient.quantity} from ${token.issuer} to ${recipient.account}`)

    //console.log("remaining balance for "+token.issuer +" "+ JSON.stringify(await getBalance(token.issuer), null, 2))

  } catch (err) {
    console.error(`cannot transfer from ${token.issuer} to ${recipient.account} (${recipient.quantity})\n* error: ` + err + `\n`)
  }
}

const reset = async ({ account }) => {

  if (!isLocal()) {
    console.log("Don't reset contracts on testnet or mainnet!")
    return
  }

  try {
    console.log(`will reset contract ${account}`)

    await eos.transaction({
      actions: [
        {
          account,
          name: 'reset',
          authorization: [{
            actor: account,
            permission: 'active'
          }],
          data: {}
        }
      ]
    })
    console.log(`reset contract ${account}`)

  } catch (err) {
    console.error(`cannot reset contract ${account}\n* error: ` + err + `\n`)

  }
}

const resetByName = async ( contractName ) => {
  try {
    await reset(accounts[contractName])
  } catch (err) {
    console.error(`cannot resetByName contract ${contractName}\n* error: ` + err + `\n`)
  }
}

const isExistingAccount = async (account) => {
  let exists = false

  try {
    await eos.getAccount(account)
    exists = true
  } catch (err) {
    exists = false
  }

  return exists
}

const isActionPermission = permission => permission.action
const isActorPermission = permission => permission.actor && !permission.key
const isCreateActorPermission = permission => permission.type == "createActorPermission"
const isKeyPermission = permission => permission.key && !permission.actor

const updatePermissions = async () => {
  for (const contractName in contractPermissions) {
    const permissionsList = contractPermissions[contractName];
    await updatePermissionsList(permissionsList)
  }
}

const updatePermissionsList = async (listOfPermissions) => {

  console.log("Updating permissions...")

  for (let current = 0; current < listOfPermissions.length; current++) {
    const permission = listOfPermissions[current]

    if (isActionPermission(permission)) {
      const { target, action } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      await allowAction(targetAccount, targetRole, action)

    } else if (isCreateActorPermission(permission)) {
      const { target, actor, parent } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      const [ actorAccount, actorRole ] = actor.split('@')
      await createActorPermission(targetAccount, targetRole, parent, actorAccount, actorRole)

    } else if (isActorPermission(permission)) {
      const { target, actor } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      const [ actorAccount, actorRole ] = actor.split('@')
      await addActorPermission(targetAccount, targetRole, actorAccount, actorRole)

    } else if (isKeyPermission(permission)) {
      const { target, parent, key } = permission
      const [ targetAccount, targetRole ] = target.split('@')
      await createKeyPermission(targetAccount, targetRole, parent, key)

    } else {
      console.log(`invalid permission #${current}`)
    }
  }  
}


const deployAllContracts = async () => {
  const ownerExists = await isExistingAccount(accounts.owner.account)

  if (!ownerExists) {
    console.log(`owner ${accounts.owner.account} should exist before deployment`)
    return
  }
  const accountNames = Object.keys(accounts)

  // First, create all tokens
  for (let current = 0; current < accountNames.length; current++) {
    const accountName = accountNames[current]
    const account = accounts[accountName]
    if (account.type === 'token') {
      console.log("deploying token " + account.name + " to " + account.account)
      await createAccount(account)
      await deploy(account)
      await createCoins(account)
    }
    await sleep(500)
  }

  // Then, create the other accounts
  for (let current = 0; current < accountNames.length; current++) {
    const accountName = accountNames[current]
    const account = accounts[accountName]

    if (account.type === 'token') {
      continue;
    }

    await createAccount(account)

    if (account.type === 'contract') {
      await deploy(account)
    }

    if (account.quantity && Number.parseFloat(account.quantity) > 0) {
      await transferCoins(accounts.hyphatoken, account)
    }

    await sleep(501)
  }
  
  await updatePermissions()
}

const deployAllAccounts = async () => {
  const ownerExists = await isExistingAccount(accounts.owner.account)

  if (!ownerExists) {
    console.log(`owner ${accounts.owner.account} should exist before deployment`)
    return
  }

  if (accounts.testtoken) {
    await createCoins(accounts.testtoken)
  }
  if (accounts.hyphatoken) {
    await createCoins(accounts.hyphatoken)
  }

  const accountNames = Object.keys(accounts)
  
  for (let current = 0; current < accountNames.length; current++) {
    const accountName = accountNames[current]
    const account = accounts[accountName]

    await createAccount(account)
  
    if (account.quantity && Number.parseFloat(account.quantity) > 0) {
      await transferCoins(accounts.hyphatoken, account)
    }

    await sleep(200)
  }
  
}

module.exports = { 
  source, deployAllContracts, updatePermissions, 
  resetByName, changeOwnerAndActivePermission, 
  changeExistingKeyPermission, addActorPermission,
  removeAllActorPermissions,
  listPermissions,
  updatePermissionsList,
  deployAllAccounts
}
