const fs = require('fs')
const path = require('path')

const { eos, encodeName, accounts, ownerPublicKey, activePublicKey } = require('./helper')
const createAccount = require('./createAccount')

const deploy = async (name) => {
    const { code, abi } = await source(name)

    let account = accounts[name]
    console.log(`deploy ${account.name}`)
    let contractName = account.name
    
    await createAccount(account)

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
  
    await eos.setcode({
      account: account.account,
      code,
      vmtype: 0,
      vmversion: 0
    }, {
      authorization: `${account.account}@owner`
    })
    console.log("code deployed")


  console.log("abi deployed")

  console.log(`Success: ${name} deployed to ${account.account}`)
}

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

module.exports = deploy
