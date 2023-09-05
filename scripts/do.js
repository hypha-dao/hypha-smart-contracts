#!/usr/bin/env node

const test = require('./test')
const program = require('commander')
const compile = require('./compile')
const { eos, isLocal, names, accounts, allContracts, allContractNames, allBankAccountNames, isTestnet, getTableRows, contractPermissions } = require('./helper')
const { joinhypha, oracleuser, tier_vesting, launch_sale, paycpu, daoAccount } = names

const { proposeDeploy, proposeChangeGuardians, setCGPermissions, proposeKeyPermissions, issueHypha, sendHypha } = require('./propose_deploy')
const deploy = require('./deploy.command')
const { deployAllContracts, updatePermissions, resetByName,
  changeOwnerAndActivePermission,
  changeExistingKeyPermission,
  addActorPermission,
  removeAllActorPermissions,
  listPermissions,
  updatePermissionsList,
  deployAllAccounts
} = require('./deploy')


const getContractLocation = (contract) => {
  if (contract == 'sale') {
    return {
      source: `./src/hypha.${contract}.cpp`,
      include: ""
    }
  // launch sale is just sale deployed to a different location
  } else if (contract == 'launch_sale') {
    return {
      source: `./src/hypha.sale.cpp`,
      include: "",
      contractSourceName: "sale"
    }
  } else if (contract == 'hyphatoken') {
    return {
      source: `./src/seeds.startoken.cpp`,
      include: "",
      contractSourceName: "startoken"
    }
  } else if (contract == 'joinhypha') {
    return {
      source: `./src/hypha.accountcreator.cpp`,
      include: "",
    }
  }
  return {
    source: `./src/${contract}.cpp`,
    include: ""
  }

}

const compileAction = async (contract) => {
  try {
    var { source, include, contractSourceName } = getContractLocation(contract)
    await compile({
      contract: contract,
      source,
      include,
      contractSourceName
    })
    console.log(`${contract} compiled`)
  } catch (err) {
    console.log("compile failed for " + contract + " error: " + err)
  }
}

const deployAction = async (contract) => {
  try {
    await deploy(contract)
    console.log(`${contract} deployed`)
  } catch (err) {
    let errStr = ("" + err).toLowerCase()
    if (errStr.includes("contract is already running this version of code")) {
      console.log(`${contract} code was already deployed`)
    } else {
      console.log("error deploying ", contract)
      console.log(err)
    }
  }
}

const resetAction = async (contract) => {
  if (contract == "history") {
    console.log("history can't be reset, skipping...")
    console.log("TODO: Add reset action for history that resets all tables")
    return
  }

  if (!isLocal()) {
    console.log("Don't reset contracts on testnet or mainnet!")
    return
  }

  try {
    await resetByName(contract)
    console.log(`${contract} reset`)
  } catch (err) {
      console.log("error reset ", contract)
      console.log(err)
    
  }
}

const runAction = async (contract) => {
  await compileAction(contract)
  await deployAction(contract)
}

const permissionsAction = async (contract) => {
  try {
    const permissions = contractPermissions[contract]
    console.log("permissions for " + contract + " " + JSON.stringify(permissions, null, 2))
    await updatePermissionsList(permissions)
    console.log(`${contract} permissions updated.`)
  } catch (err) {
    console.log("permissions update failed for " + contract + " error: " + err)
  }
}


const batchCallFunc = async (contract, moreContracts, func) => {
  if (contract == 'all') {
    for (const contract of allContracts) {
      await func(contract)
    }
  } else {
    await func(contract)
  }
  if (moreContracts) {
    for (var i = 0; i < moreContracts.length; i++) {
      await func(moreContracts[i])
    }
  }
}

const initAction = async (compile = true) => {
  if (compile) {
    for (i = 0; i < allContracts.length; i++) {
      let item = allContracts[i];
      console.log("compile ... " + item);
      await compileAction(item);
    }
  } else {
    console.log("no compile")
  }

  await deployAllContracts()

}

const updatePermissionAction = async () => {
  await updatePermissions()
}

program
  .command('compile <contract> [moreContracts...]')
  .description('Compile custom contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, compileAction)
  })
program
  .command('deploy <contract> [moreContracts...]')
  .description('Deploy custom contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, deployAction)
  })

program
  .command('run <contract> [moreContracts...]')
  .description('compile and deploy custom contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, runAction)
  })

  program
  .command('test <contract> [moreContracts...]')
  .description('Run unit tests for deployed contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, test)
  })

  program
  .command('permissions <contract> [moreContracts...]')
  .description('Run unit tests for deployed contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, permissionsAction)
  })

program
  .command('reset <contract> [moreContracts...]')
  .description('Reset deployed contract')
  .action(async function (contract, moreContracts) {
    await batchCallFunc(contract, moreContracts, resetAction)
  })

program
  .command('init [compile]')
  .description('Initial creation of all accounts and contracts contract')
  .action(async function (compile) {
    var comp = compile != "false"
    await initAction(comp)
  })

/// 
/// Account creator needs to be configured with oracle account and then activate needs to be called on it
/// 
program
  .command('setupAccountCreator')
  .description('set up Account Creator')
  .action(async function () {
    const contract = await eos.contract(joinhypha)

    console.log("set oracle account authorized to create accounts")
    await contract.setconfig(oracleuser, oracleuser, { authorization: `${joinhypha}@active` })

    console.log("activate")
    await contract.activate({ authorization: `${joinhypha}@active` })

  })

program
  .command('listAccountCreator')
  .description('set up Account Creator')
  .action(async function () {
    const contract = await eos.contract(joinhypha)

    const res = await getTableRows({
      code: joinhypha,
      scope: joinhypha,
      table: 'config',
      json: true,
      limit: 10
    })

    console.log("Account Creator configuration at " + joinhypha + ": " + JSON.stringify(res, null, 2))


  })


program
  .command('configurePayCpu')
  .description('set up pay cpu config')
  .action(async function () {
    const contract = await eos.contract(paycpu)

    console.log("set dao contract on " + paycpu + " to: " + daoAccount)
    await contract.configure(daoAccount, { authorization: `${paycpu}@active` })
    console.log("done");

  })

program
  .command('listPayCpu')
  .description('show pay cpu config')
  .action(async function () {
    const res = await getTableRows({
      code: paycpu,
      scope: paycpu,
      table: 'configs',
      json: true,
      limit: 10
    })

    console.log("configuration of " + paycpu + ": " + JSON.stringify(res, null, 2))

  })

  program
  .command('config_launch_sale')
  .description('set up launch sale')
  .action(async function () {
    console.log("setting permissions on launch sale " + launch_sale)
    await batchCallFunc("launch_sale", [], permissionsAction)

    const contract = await eos.contract(launch_sale)
    console.log("set vesting contract on " + launch_sale + " to: " + tier_vesting)
    await contract.cfglaunch(tier_vesting, { authorization: `${launch_sale}@active` })
    console.log("done");

  })

  program
  .command('config_tier_vesting')
  .description('set up tier vesting')
  .action(async function () {

    console.log("setting permissions tier vesting " + tier_vesting)
    await batchCallFunc("tier_vesting", [], permissionsAction)

    //void addtier(name tier_id, asset amount, std::string name);

    const contract = await eos.contract(tier_vesting)
    console.log("set adding tiers to: " + tier_vesting)

    const addTier = async (tier_id, total_amount, name ) => {
      console.log(tier_vesting + ": adding tier: " + tier_id + " name: " + name + " token: " + total_amount)
      await contract.addtier(tier_id, total_amount, name, { authorization: `${tier_vesting}@active` })
    }

    await addTier("launch", "0.00 HYPHA", "Launch Stakeholders")
    await addTier("earlystakedh", "0.00 HYPHA", "Early Stakeholders")
    await addTier("hypha.dao.tr", "0.00 HYPHA", "Hypha DAO Treasury")
    await addTier("incentive", "0.00 HYPHA", "Incentives")
    
    console.log("done");

  })

  program
  .command('updatePermissions')
  .description('Update all permissions of all contracts')
  .action(async function () {
    await updatePermissionAction()
  })

  program
  .command('add_accounts')
  .description('Add all accounts')
  .action(async function () {
    await deployAllAccounts()
    console.log('done.')
  })


program
  .command('changekey <contract> <key>')
  .description('Change owner and active key')
  .action(async function (contract, key) {
    console.print(`Change key of ${contract} to ` + key + "\n")
    await changeOwnerAndActivePermission(contract, key)
  })

program
  .command('change_key_permission <contract> <role> <parentrole> <key>')
  .description('Change owner and active key')
  .action(async function (contract, role, parentrole, key) {
    console.print(`Change key of ${contract} to ` + key + "\n")
    await changeExistingKeyPermission(contract, role, parentrole, key)
  })

program
  .command('add_permission <target> <targetrole> <actor> <actorrole>')
  .description('Add permission')
  .action(async function (target, targetrole, actor, actorrole) {
    console.print(`Adding ${actor}@${actorrole} to ${target}@${targetrole}` + "\n")
    await addActorPermission(target, targetrole, actor, actorrole)
  })



program.parse(process.argv)

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
  program.help();
}

