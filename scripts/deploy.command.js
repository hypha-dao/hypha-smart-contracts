const fs = require('fs')
const path = require('path')
const { exec } = require('child_process');

const { eos, encodeName, accounts, ownerPublicKey, activePublicKey, isLocal, httpEndpoint, useCleos } = require('./helper')
const createAccount = require('./createAccount')

const deployWithCleos = async ({ account, contractDir, codeFile, abiFile, endPoint }) => {
  const cleosCommand = `cleos -u "${endPoint}" set contract ${account.account} ${contractDir} ${codeFile} ${abiFile}`;
  console.log("command: " + cleosCommand);
  
  return new Promise((resolve, reject) => {
    exec(cleosCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing cleos: ${error.message}`);
        reject(error);
        return;
      }
      if (stderr) {
        console.error(`cleos stderr: ${stderr}`); 
      }
      console.log(`cleos done.`);
      resolve(stdout);
    });
  });
};

const deployWithEos = async ({ account, abi, code }) => {
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
};

const deploy = async (name) => {
  const { code, abi, contractDir, codeFile, abiFile } = await source(name)

  let account = accounts[name]
  console.log(`deploy ${account.account}`)

  if (isLocal()) {
    await createAccount(account)
  }

  if (!code)
    throw new Error('code not found')

  if (!abi)
    throw new Error('abi not found')

  if (useCleos) {
    const endPoint = httpEndpoint; // this is from the helper file - depends on
    await deployWithCleos({
      account,
      contractDir,
      codeFile,
      abiFile,
      endPoint
    });
  } else {
    await deployWithEos({
      account,
      abi,
      code
    });
  }

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

  console.log("code " + codePath)
  console.log("abi " + abiPath)

  const codeDir = path.dirname(codePath);
  const abiDir = path.dirname(abiPath);

  if (codeDir != abiDir) {
    throw "code and abi need to be in the same directory " + { codeDir, abiDir }
  }
  const codeFile = path.basename(codePath);
  const abiFile = path.basename(abiPath);
  const contractDir = codeDir

  console.log("contractDir " + contractDir)
  console.log("codeFile " + codeFile)
  console.log("abiFile " + abiFile)

  const code = new Promise(resolve => {
    fs.readFile(codePath, (_, r) => resolve(r))
  })
  const abi = new Promise(resolve => {
    fs.readFile(abiPath, (_, r) => resolve(r))
  })

  return Promise.all([code, abi]).then(([code, abi]) => ({ code, abi, contractDir, codeFile, abiFile }))
}

module.exports = deploy