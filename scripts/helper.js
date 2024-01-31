require('dotenv').config()

const Eos = require('./eosjs-port')
const R = require('ramda')

// Note: For some reason local chain ID is different on docker vs. local install of eosio
const dockerLocalChainID = 'cf057bbfb72640471fd910bcb67639c22df9f92470936cddc1ade0e2f2e7dc4f'
const eosioLocalChainID = '8a34ec7df1b8cd06ff4a8abbaa7cc50300823350cadc59ab296cb00d104d2b8f'

const networks = {
  local: eosioLocalChainID,
  telosTestnet: '1eaa0824707c8c16bd25145493bf062aecddfeb56c736f6ba6397f3195f33c9f',
  telosMainnet: '4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11',
  eosMainnet: 'aca376f206b8fc25a6ed44dbdc66547c36c6c33e3a119ffbeaef943642f0e906',
  eosTestnet: '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
}

const networkDisplayName = {
  local: 'Local',
  telosTestnet: 'Telos Testnet',
  telosMainnet: 'Telos Mainnet',
  eosMainnet: 'EOS Mainnet',
  eosTestnet: 'EOS Testnet Jungle 4',
}

const endpoints = {
  local: 'http://127.0.0.1:8888',
  telosTestnet: 'https://testnet.telos.net',
  telosMainnet: 'https://mainnet.telos.net',
  // telosMainnet: 'https://telos.greymass.com',
  eosMainnet: 'http://eos.greymass.com',
  // eosTestnet: 'https://jungle4.dfuse.eosnation.io',
  eosTestnet: 'http://jungle4.eossweden.org',
}

const ownerAccounts = {
  local: 'owner',
  telosTestnet: 'hyphaoracle1',
  telosMainnet: 'hypha',
  eosMainnet: 'hypha',
  eosTestnet: 'hyphadaotest',
}

const gQLEndpoints = {
  local: "",
  telosMainnet: "https://alpha-dhomn.tekit.io/graphql",
  telosTestnet: "https://alpha-stts.tekit.io/graphql",
  eosMainnet: "https://hypha.us-east-1.aws.cloud.dgraph.io/graphql", // NOTE This needs a HEADER with JWT token "X-Dgraph-AccessToken": "ey..."
  eosTestnet: "https://nameless-brook-400226.eu-central-1.aws.cloud.dgraph.io/graphql"
}

const {
  EOSIO_NETWORK,
  EOSIO_API_ENDPOINT,
  EOSIO_CHAIN_ID
} = process.env

const chainId = EOSIO_CHAIN_ID || networks[EOSIO_NETWORK] || networks.local
const httpEndpoint = EOSIO_API_ENDPOINT || endpoints[EOSIO_NETWORK] || endpoints.local
const owner = ownerAccounts[EOSIO_NETWORK] || ownerAccounts.local
const graphQLEndpoint = gQLEndpoints[EOSIO_NETWORK]

const netName = EOSIO_NETWORK != undefined ? (networkDisplayName[EOSIO_NETWORK] || "INVALID NETWORK: " + EOSIO_NETWORK) : "Local"
console.log("" + netName)

const publicKeys = {
  [networks.local]: ['EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV', 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'],
  [networks.telosMainnet]: ['EOS6kp3dm9Ug5D3LddB8kCMqmHg2gxKpmRvTNJ6bDFPiop93sGyLR', 'EOS6kp3dm9Ug5D3LddB8kCMqmHg2gxKpmRvTNJ6bDFPiop93sGyLR'],
  [networks.telosTestnet]: ['EOS8MHrY9xo9HZP4LvZcWEpzMVv1cqSLxiN2QMVNy8naSi1xWZH29', 'EOS8C9tXuPMkmB6EA7vDgGtzA99k1BN6UxjkGisC1QKpQ6YV7MFqm'],
  [networks.eosMainnet]: [],
  [networks.eosTestnet]: ['EOS8dTpsSqM7r8TpaK4j5GasMgzocK4qKeKtsa1cYaWcWAth3EVxi', 'EOS8dTpsSqM7r8TpaK4j5GasMgzocK4qKeKtsa1cYaWcWAth3EVxi'],
}
const [ownerPublicKey, activePublicKey] = publicKeys[chainId]

const saleKeys = {
  [networks.local]: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV', // normal dev key
  [networks.telosTestnet]: 'EOS7yHExhTMu1m23vAXHzMSBG632ry7yeas73TwBvFf13bEZCXfPP',
  [networks.telosMainnet]: 'EOS6qQjjYCoTmFha6rUk9ciE9NLTK1pvM7YgG6rnX2BLcRYzb9FWg',
  [networks.eosMainnet]: [],
  [networks.eosTestnet]: ['EOS6qQjjYCoTmFha6rUk9ciE9NLTK1pvM7YgG6rnX2BLcRYzb9FWg'],
}

const launchSaleKeys = {
  [networks.local]: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV', // normal dev key
  [networks.telosTestnet]: 'EOS7yHExhTMu1m23vAXHzMSBG632ry7yeas73TwBvFf13bEZCXfPP',
  [networks.telosMainnet]: 'EOS5S4SbC42m2PKYsaaTywjtfgrc2hsuguMG3tkLDr7xeqTiyrYS4',
  [networks.eosMainnet]: [],
  [networks.eosTestnet]: ['EOS6qQjjYCoTmFha6rUk9ciE9NLTK1pvM7YgG6rnX2BLcRYzb9FWg'],
}

const salePublicKey = saleKeys[chainId]
const launchSalePublicKey = launchSaleKeys[chainId]


const account = (accountName, quantity = '0.00 HYPHA', pubkey = activePublicKey) => ({
  type: 'account',
  account: accountName,
  creator: owner,
  publicKey: pubkey,
  stakes: {
    cpu: '1.0000 TLOS',
    net: '1.0000 TLOS',
    ram: 10000
  },
  quantity
})

const contract = (accountName, contractName, quantity = '0.00 HYPHA') => ({
  ...account(accountName, quantity),
  type: 'contract',
  name: contractName,
  stakes: {
    cpu: '1.0000 TLOS',
    net: '1.0000 TLOS',
    ram: 700000
  }
})

const testnetUserPubkey = "EOS8M3bWwv7jvDGpS2avYRiYh2BGJxt5VhfjXhbyAhFXmPtrSd591"

const token = (accountName, issuer, supply, name) => ({
  ...contract(accountName, name),
  type: 'token',
  issuer,
  supply
})

const accountsMetadata = (network) => {
  if (network == networks.local) {
    return {
      owner: account(owner),
      hyphatoken: token('hypha.hypha', owner, '1500000000.00 HYPHA', "hyphatoken"),
      voice_token: contract('voice.hypha', 'voice_token'),
      husd_token: contract('husd.hypha', 'husd_token'),

      firstuser: account('seedsuseraaa', '10000000.00 HYPHA'),
      seconduser: account('seedsuserbbb', '10000.00 HYPHA'),
      thirduser: account('seedsuserccc', '50000.00 HYPHA'),
      fourthuser: account('seedsuserxxx', '100000.00 HYPHA'),
      fifthuser: account('seedsuseryyy', '100000.00 HYPHA'),
      sixthuser: account('seedsuserzzz', '5000.00 HYPHA'),
      oracleuser: account('hyphaoracle1', '10000.00 HYPHA'),

      // for testing..
      daoContract: account('dao.hypha', 'dao'),
      login: contract('logintohypha', 'login'),
      sale: contract('sale.hypha', 'sale'),
      launch_sale: contract('launch.hypha', 'launch_sale'),
      joinhypha: contract('join.hypha', 'joinhypha'),
      paycpu: contract('paycpu.hypha', 'paycpu'),
      tier_vesting: account('vestng.hypha', 'tier_vesting'),
      staking: account('stake.hypha', 'staking'),
      upvote: account('upvote.hypha', 'upvote'),
      deferredtrx: account('deftrx.hypha', 'deferredtrx'),

    }
  } else if (network == networks.telosMainnet) {
    return {
      owner: account(owner),
      oracleuser: account('hyphaoracle1'),

      sale: contract('sale.hypha', 'sale'),
      launch_sale: contract('launch.hypha', 'launch_sale'),
      joinhypha: contract('join.hypha', 'joinhypha'),
      paycpu: contract('paycpu.hypha', 'paycpu'),
      daoContract: account('dao.hypha', 'dao'),
      tier_vesting: account('vestng.hypha', 'tier_vesting'),
      staking: account('stake.hypha', 'staking'),

      // we don't need these here
      hyphatoken: account(' '),
      voice_token: account(' '),


    }
  } else if (network == networks.telosTestnet) {
    return {
      owner: account(owner),
      oracleuser: account('hyphaoracle1'),
      hyphatoken: token('mtrwardhypha', owner, '1500000000.00 HYPHA', "hyphatoken"),
      voice_token: contract('mtvoicehypha', 'voice_token'),
      husd_token: contract('mtpegtkhypha', 'husd_token'),

      firstuser: account('seedsuseraaa', '1000000.00 HYPHA'),
      seconduser: account('seedsuserbbb', '10000.00 HYPHA'),
      thirduser: account('seedsuserccc', '10000.00 HYPHA'),
      fourthuser: account('seedsuserxxx', '10000.00 HYPHA', testnetUserPubkey),
      fifthuser: account('seedsuseryyy', '10000.00 HYPHA', testnetUserPubkey),
      sixthuser: account('seedsuserzzz', '10000.00 HYPHA', testnetUserPubkey),

      login: contract('logintohypha', 'login'),
      sale: contract('salexhypha11', 'sale'),
      launch_sale: contract('launchxhypha', 'launch_sale'),
      joinhypha: contract('joinhypha111', 'joinhypha'),
      paycpu: contract('paycpuxhypha', 'paycpu'),
      daoContract: account('mtdhoxhyphaa', 'dao'),
      tier_vesting: account('vestngxhypha', 'tier_vesting'),
      staking: account('stakexhypha1', 'staking'),

    }
  } else if (network == networks.eosMainnet) {
    return {
      oracleuser: account('hyphaoracle1'),

      // EOS mainnet doesn't have most of the accounts
      joinhypha: contract('join.hypha', 'joinhypha'),
      login: contract('logintohypha', 'login'),
      paycpu: contract('paycpu.hypha', 'paycpu'),

      /// not functional
      sale: contract('sale.hypha', 'sale'),
      daoContract: account('dao.hypha', 'dao'),
      tier_vesting: account('vestng.hypha', 'tier_vesting'),
      staking: account('stake.hypha', 'staking'),

      // not available but need to be defined
      launch_sale: account(' '),
      hyphatoken: account(' '),
      voice_token: account(' '),
      
    }
  } else if (network == networks.eosTestnet) {
    return {
      oracleuser: account('hyphaoracle1'),

      // we don't deploy sale contract on EOS, but defining it here
      sale: contract('sale.hypha', 'sale'),
      login: contract('logintohypha', 'login'),
      joinhypha: contract('joinxhypha11', 'joinhypha'),
      paycpu: contract('paycpuxhypha', 'paycpu'),
      daoContract: account('daoxhypha111', 'dao'),
      tier_vesting: account('vestngxhypha', 'tier_vesting'),
      staking: account('stakexhypha1', 'staking'),

      // not available but need to be defined
      launch_sale: account(' '),
      hyphatoken: account(' '),
      voice_token: account(' '),

    }
  } else {
    throw new Error(`${network} deployment not supported`)
  }
}

const accounts = accountsMetadata(chainId)
const names = R.mapObjIndexed((item) => item.account, accounts)
const allContracts = []
const allContractNames = []
const allAccounts = []
const allBankAccountNames = []
for (let [key, value] of Object.entries(names)) {
  if (accounts[key].type == "contract" || accounts[key].type == "token") {
    allContracts.push(key)
    allContractNames.push(value)
  } else {
    if (value.indexOf(".seeds") != -1) {
      allAccounts.push(key)
      allBankAccountNames.push(value)
    }
  }
}
allContracts.sort()
allContractNames.sort()
allAccounts.sort()
allBankAccountNames.sort()

/// PERMISSIONS

/// Set up all special permissions


// This is a semi-public key that can be used to pay for CPU but will only work for hypha members 
const payForCPUKeys = {
  [networks.local]: 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV',
  [networks.telosMainnet]: 'EOS65Ug7bqgMdom1Vu9QPdRu4ie7Yey4VmyoJDvcE4H9vfy8qC8yy',
  [networks.telosTestnet]: 'EOS65Ug7bqgMdom1Vu9QPdRu4ie7Yey4VmyoJDvcE4H9vfy8qC8yy',
  [networks.eosMainnet]: 'EOS65Ug7bqgMdom1Vu9QPdRu4ie7Yey4VmyoJDvcE4H9vfy8qC8yy',
  [networks.eosTestnet]: 'EOS65Ug7bqgMdom1Vu9QPdRu4ie7Yey4VmyoJDvcE4H9vfy8qC8yy',
}

const payForCPUPublicKey = payForCPUKeys[chainId]

var permissions = [

]

const contractPermissions = {
  sale: [
    {
      target: `${accounts.sale.account}@active`,
      actor: `${accounts.sale.account}@eosio.code`
    }, {
      target: `${accounts.sale.account}@newpayment`,
      key: salePublicKey,
      parent: 'active'
    }, {
      target: `${accounts.sale.account}@newpayment`,
      action: 'newpayment'
    },
  ],

  launch_sale: [
    {
      target: `${accounts.launch_sale.account}@active`,
      actor: `${accounts.launch_sale.account}@eosio.code`
    }, {
      target: `${accounts.launch_sale.account}@newpayment`,
      key: launchSalePublicKey,
      parent: 'active'
    }, {
      target: `${accounts.launch_sale.account}@newpayment`,
      action: 'newpayment'
    },
  ],

  joinhypha: [
    {
      target: `${accounts.joinhypha.account}@active`,
      actor: `${accounts.joinhypha.account}@eosio.code`
    }, {
      target: `${accounts.daoContract.account}@autoenroll`,
      actor: `${accounts.joinhypha.account}@eosio.code`,
      parent: 'active',
      type: 'createActorPermission'
    }, {
      target: `${accounts.daoContract.account}@autoenroll`,
      action: 'autoenroll'
    }
  ],

  // owner     1:    1 EOS6TzH8pWkRqzdQLpVz7W2awY2CycTckkkjEi9FvormYTiVff5iz, 1 dao.hypha@active
  // active     1:    1 EOS6TzH8pWkRqzdQLpVz7W2awY2CycTckkkjEi9FvormYTiVff5iz, 1 dao.hypha@active, 1 dao.hypha@eosio.code, 1 voice.hypha@eosio.code
  paycpu: [
    {
      target: `${accounts.paycpu.account}@payforcpu`,
      key: payForCPUPublicKey,
      parent: 'active'
    }, {
      target: `${accounts.paycpu.account}@payforcpu`,
      action: 'payforcpu'
    }, {
      target: `${accounts.paycpu.account}@newacct`,
      actor: `${accounts.joinhypha.account}@eosio.code`,
      parent: 'active',
      type: 'createActorPermission'
    },{
      target: `${accounts.paycpu.account}@newacct`,
      action: 'newacct'
    }, 
    
  ],

  tier_vesting: [
    {
      target: `${accounts.tier_vesting.account}@active`,
      actor: `${accounts.tier_vesting.account}@eosio.code`
    },
  ],

  staking: [
    {
      target: `${accounts.staking.account}@active`,
      actor: `${accounts.staking.account}@eosio.code`
    },
  ],

  // External contracts / binaries permissions

  hyphatoken: [
    {
      target: `${accounts.hyphatoken.account}@active`,
      actor: `${accounts.hyphatoken.account}@eosio.code`
    }, {
      target: `${accounts.hyphatoken.account}@active`,
      actor: `${accounts.daoContract.account}@eosio.code`,
    }
  ],

  voice_token: [
    {
      target: `${accounts.voice_token.account}@active`,
      actor: `${accounts.voice_token.account}@eosio.code`
    }, {
      target: `${accounts.voice_token.account}@active`,
      actor: `${accounts.daoContract.account}@eosio.code`,
    }
    // , { // I DONT THINK WE NEED THIS SINCE WE HAVE code permission
    //   target: `${accounts.voice_token.account}@active`,
    //   actor: `${accounts.daoContract.account}@active`,
    // }
],

daoContract: [
  {
    target: `${accounts.daoContract.account}@active`,
    actor: `${accounts.daoContract.account}@eosio.code`
  }, 
  // Not sure about this - we could also use a service account
  // {
  //   target: `${accounts.daoContract.account}@executenext`,
  //   actor: `${accounts.paycpu.account}@payforcpu`,
  //   parent: 'active',
  //   type: 'createActorPermission'
  // }, {
  //   target: `${accounts.daoContract.account}@executenext`,
  //   action: 'executenext'
  // }
],

}

const isTestnet = (chainId == networks.telosTestnet) || (chainId == networks.eosTestnet)
const isLocalNet = chainId == networks.local

// KEY PROVIDERS 
// via .env - need to phase these out and use cleos instead.

// Note: We used to put keys into the .env file but that's unsecure, so going 
// forward deployments are done with cleos or msig - only with protected wallets  
const keyProviders = {
  [networks.local]: [
    process.env.LOCAL_PRIVATE_KEY, 
    process.env.LOCAL_PRIVATE_KEY, 
    process.env.APPLICATION_KEY
  ],
  [networks.telosMainnet]: [
    process.env.TELOS_MAINNET_ACTIVE_KEY,
    process.env.TELOS_MAINNET_ACCOUNTS_KEY,
    // process.env.TELOS_MAINNET_HYPHA_OWNER_KEY, 
    // process.env.EXCHANGE_KEY,
  ],
  [networks.telosTestnet]: [
    process.env.TELOS_TESTNET_ACTIVE_KEY,
    process.env.TELOS_TESTNET_DAO_CREATOR_KEY,
    process.env.TELOS_TESTNET_DAO_CONTRACT_KEY,
    process.env.TELOS_TESTNET_ACCOUNTS_KEY,
  ],
  [networks.eosMainnet]: [
    process.env.EOS_MAINNET_ACTIVE_KEY,
    process.env.EOS_MAINNET_ACCOUNTS_KEY,
    process.env.EOS_MAINNET_PAYCPU,
  ],
  [networks.eosTestnet]: [
    process.env.EOS_TESTNET_ACTIVE_KEY,
    process.env.EOS_TESTNET_DAO_CREATOR_KEY,
    process.env.EOS_TESTNET_ACCOUNTS_KEY,
  ]

}

const keyProvider = keyProviders[chainId].filter((item) => item)

if (keyProvider.length == 0 || keyProvider[0] == null) {
  console.log("ERROR: Invalid Key Provider: " + JSON.stringify(keyProvider, null, 2))
}
const isLocal = () => { return chainId == networks.local }
const isTelosTestnet = () => { return chainId == networks.telosTestnet }

const config = {
  keyProvider,
  httpEndpoint,
  chainId
}

const eos = new Eos(config, isLocal)

// Use eosNoNonce for not adding a nonce to every action
// nonce means every action has a unique nonce - an action on policy.seeds
// The nonce makes it so no duplicate transactions are recorded by the chain
// So it makes unit tests a lot more predictable
// But sometimes the nonce is undesired, example, when testing policy.seeds itself
// NOTE This is changing global variables, not working. Only needed for policy test.
// const eosNoNonce = new Eos(config, false)

setTimeout(async () => {
  let info = await eos.getInfo({})
  if (info.chain_id != chainId) {
    console.error("Fix this by setting local chain ID to " + info.chain_id)
    console.error('Chain ID mismatch, signing will not work - \nactual Chain ID: "+info.chain_id + "\nexpected Chain ID: "+chainId')
    throw new Error("Chain ID mismatch")
  }
})

const getEOSWithEndpoint = (ep) => {
  const config = {
    keyProvider,
    httpEndpoint: ep,
    chainId
  }
  return new Eos(config, isLocal)
}

const getTableRows = eos.getTableRows

const getTelosBalance = async (user) => {
  const balance = await eos.getCurrencyBalance(names.tlostoken, user, 'TLOS')
  return Number.parseInt(balance[0])
}

const initContracts = (accounts) =>
  Promise.all(
    Object.values(accounts).map(
      account => eos.contract(account)
    )
  ).then(
    contracts => Object.assign({}, ...Object.keys(accounts).map(
      (account, index) => ({
        [account]: contracts[index]
      })
    ))
  )

const ecc = require('eosjs-ecc')
const sha256 = ecc.sha256

const ramdom64ByteHexString = async () => {
  let privateKey = await ecc.randomKey()
  const encoded = Buffer.from(privateKey).toString('hex').substring(0, 64);
  return encoded
}
const fromHexString = hexString => new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))

const createKeypair = async () => {
  let private = await Eos.getEcc().randomKey()
  let public = Eos.getEcc().privateToPublic(private)
  return { private, public }
}

const sleep = async (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function asset(quantity) {
  if (typeof quantity == 'object') {
    if (quantity.symbol) {
      return quantity
    }
    return null
  }
  const [amount, symbol] = quantity.split(' ')
  const indexDecimal = amount.indexOf('.')
  const precision = amount.substring(indexDecimal + 1).length
  return {
    amount: parseFloat(amount),
    symbol,
    precision,
    toString: quantity
  }
}

const sendTransaction = async (actions) => {
  return await eos.transaction({
    actions
  })
}

module.exports = {
  keyProvider, httpEndpoint,
  eos, getEOSWithEndpoint, getTableRows, initContracts,
  accounts, names, ownerPublicKey, activePublicKey, permissions, sha256, isLocal, ramdom64ByteHexString, createKeypair,
  testnetUserPubkey, getTelosBalance, fromHexString, allContractNames, allContracts, allBankAccountNames, sleep, asset, isTestnet,
  isTelosTestnet,
  sendTransaction,
  contractPermissions,
  graphQLEndpoint
}
