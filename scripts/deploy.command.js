const fs = require('fs')
const path = require('path')

const { eos, encodeName, accounts, ownerPublicKey, activePublicKey, isLocal } = require('./helper')
const createAccount = require('./createAccount')

const deploy = async (name) => {
  const { code, abi } = await source(name)

  let account = accounts[name]
  console.log(`deploy ${account.account}`)

  if (isLocal()) {
    // Creating accounts is convenient on the local test chain
    // However, it's not going to work on a real chain - from the creator 
    // account to having enough funds, to allocating enough RAM, accounts
    // on mainnet or testnet need to be created manually. 

    await createAccount(account)
  }

  if (!code)
    throw new Error('code not found')

  if (!abi)
    throw new Error('abi not found')

  await eos.setabi({
    account: account.account,
    abi: JSON.parse(abi)
  }, {
    authorization: `${account.account}@owner`
  })
  console.log("abi deployed")

  await eos.setcode({
    account: account.account,
    code,
    vmtype: 0,
    vmversion: 0
  }, {
    authorization: `${account.account}@owner`
  })
  console.log("code deployed")

  console.log(`Success: ${name} deployed to ${account.account}`)
}

/// Search directories in order
/// return first found file
const findContract = (name, directories) => {
  for (dir of directories) {
    const result = path.join(__dirname, dir, name)
    if (fs.existsSync(result)) {
      return result
    }
  }
  throw 'file cannot be found: ' + name
}

const source = async (name) => {
  const binaryDirectories = [
    '../artifacts',
    '../binaries',
  ]
  const codePath = findContract(name.concat('.wasm'), binaryDirectories)
  const abiPath = findContract(name.concat('.abi'), binaryDirectories)

  const code = new Promise(resolve => {
    fs.readFile(codePath, (_, r) => resolve(r))
  })
  const abi = new Promise(resolve => {
    fs.readFile(abiPath, (_, r) => resolve(r))
  })

  return Promise.all([code, abi]).then(([code, abi]) => ({ code, abi }))
}

module.exports = deploy
