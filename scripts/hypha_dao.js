#!/usr/bin/env node

const program = require('commander')

const { eos, names, sleep, graphQLEndpoint } = require('./helper')

const { daoContract, voice_token, husd_token, hyphatoken } = names

const getCreateDaoData = require('../test_old/helpers/getCreateDaoData');
const Eos = require('./eosjs-port');


const Types = {
   Int: 'int64',
   String: 'string',
   Checksum: 'checksum256',
   Asset: 'asset',
   Name: 'name',
   TimePoint: 'time_point',
}

const setSetting = async (contract, setting, value) => {
   console.log("setting " + setting + " to: "+ value + " on " + daoContract)

   const data = {
      key: setting,
      value: value,
      group: null
   }

   console.log("data " + JSON.stringify(data, null, 2))

   contract.setsetting(setting, value, null, { authorization: `${daoContract}@active` })

}

const initializeDHO = async () => {

   if (!voice_token || voice_token == "") throw "no voice token set" 
   if (!hyphatoken) throw "no hypha token set" 
   if (!husd_token) throw "no HUSD token set" 

   console.log("init global DHO Settings with voice_token " + voice_token)
   console.log("init global DHO Settings with hyphatoken " + hyphatoken)
   console.log("init global DHO Settings with husd_token " + husd_token)

   const govContractSetting = [Types.Name,""+voice_token];

   console.log("init global DHO Settings with husd_token " + JSON.stringify(govContractSetting, null, 2))

   const contract = await eos.contract(daoContract)

   result = await setSetting(contract, 'governance_token_contract', govContractSetting);

   result = await setSetting(contract, 'reward_token_contract', [Types.Name, ""+hyphatoken]);

   result = await setSetting(contract, 'peg_token_contract', [Types.Name, ""+husd_token]);

   result = await setSetting(contract, 'treasury_contract', [Types.Name, 'mttrsryhypha']);

   result = await setSetting(contract, 'period_duration_sec', [Types.Int, 604800]);

   result = await setSetting(contract, 'next_schedule_id', [Types.Int, parseInt(Math.random() * 1000000)]);

   result = await setSetting(contract, 'init_period_count', [Types.Int, 10]); // optional - will use 30 if not set

   await sleep(1000);
}

const createDao = async ({
   daoName,
   daoTitle,
   ownerAccountName
}) => {
   console.log("create DAO" + daoName)

   const contract = await eos.contract(daoContract)
   const data = getCreateDaoData({
      dao_name: daoName,
      dao_title: daoTitle,
      onboarder_account: ownerAccountName
   })

   const action = {
      "account": "dao.hypha",
      "name": "createdao",
      "authorization": [
         {
            "actor": ownerAccountName,
            "permission": "active"
         }
      ], "data": {
         "config": data
      }
   }

   // const esr = await createEsrWithActions({actions: [action], endpoint: httpEndpoint})

   // console.log("esr: " + JSON.stringify(esr, null, 2))

   console.log("auth: " + JSON.stringify({ authorization: `${ownerAccountName}@active` }))

   await contract.createdao(data, { authorization: `${ownerAccountName}@owner` });
}

program
   .command('onboard <onboarder> <daoId> <member>')
   .description('onboard a single account')
   .action(async (onboarder, daoId, member) => {
      console.log("onboarding " + member + " to " + daoId + " with " + onboarder)
      const res = await autoEnrollMember({
         daoId: daoId,
         member: member,
         daoOwnerAccount: onboarder,
      })
   })


program
   .command('create_dao <daoName> <title> <ownerAccountName>')
   .description('Create a DAO')
   .action(async (daoName, title, ownerAccountName) => {

      await createDao({ daoName: daoName, daoTitle: title, ownerAccountName: ownerAccountName })
      console.log("created DAO " + daoName + " with title " + title + " owner: " + ownerAccountName)
   })

program
   .command('init_root')
   .description('initialize root')
   .action(async () => {
      console.log("setting root " + process.env.EOSIO_NETWORK)
      const contract = await eos.contract(daoContract)
      await contract.createroot('root', { authorization: `${daoContract}@active` });
      console.log("Done.")
   })

program
   .command('init_settings')
   .description('set root')
   .action(async () => {

      console.log("init settings " + process.env.EOSIO_NETWORK)

      await initializeDHO()

      console.log("Done.")

   })

program
   .command('init_calendar')
   .description('init calendar')
   .action(async () => {

      const contract = await eos.contract(daoContract)
      console.log("create calendar ")
      await contract.createcalen(true, { authorization: `${daoContract}@active` })

      console.log("Done.")

   })

   program
   .command('add_periods')
   .description('add periods')
   .action(async () => {

      const contract = await eos.contract(daoContract)
      console.log("adding 10 periods")
      graphQLEndpoint
      await contract.genperiods(daoId, 10, { authorization: `${daoContract}@active` })

      console.log("Done.")

   })



program.parse(process.argv)

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
   program.help();
}



