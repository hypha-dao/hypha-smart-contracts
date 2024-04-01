#!/usr/bin/env node

const program = require('commander')
var fs = require('fs');

const { eos, isLocal, names, accounts, allContracts, allContractNames, allBankAccountNames, isTestnet, getTableRows, contractPermissions } = require('./helper')
const { joinhypha, oracleuser, tier_vesting, launch_sale, paycpu, daoContract } = names

const getEdges = async ({ limit, reverse } = { limit: 100, reverse: false }) => {

  let readDocs = [];

  let moreDocs = true;
  let nextKey = undefined;

  while(moreDocs && (limit === -1 || readDocs.length < limit)) {

    const { rows, more, next_key } = await eos.rpc.get_table_rows({
      json: true,               // Get the response as json
      code: daoContract,      // Contract that we target
      scope: daoContract,         // Account that owns the data
      table: 'edges',        // Table name
      limit: 200,                // Maximum number of rows that we want to get
      reverse: reverse,           // Optional: Get reversed data
      show_payer: false,          // Optional: Show ram payer
      ...(reverse ? { upper_bound: nextKey } : { lower_bound: nextKey })
    });

    nextKey = next_key;

    moreDocs = more;

    let remaining = limit - readDocs.length;

    if (limit !== -1 && rows.length > remaining) {
      rows.length = remaining;
    }
    
    readDocs = readDocs.concat(rows);
  }

  return readDocs;
}

// save edges either as strings or json (default)
const saveAllEdges = async (filename, json = true) => {
    
  const edges = await getEdges({ limit: -1, reverse: false });

  console.log("Edges:", edges.length);

  if (json) {
    fs.writeFileSync(filename, JSON.stringify(edges, null, 2));
  } else {
    let edgesStr = "";

    for (let edge of edges) {
      edgesStr += `${edge.from_node} ${edge.to_node} ${edge.edge_name}\n`
    }
  
    fs.writeFileSync(filename, edgesStr);
  
  }
}

program
  .command('write_edges')
  .description('Write edges to disk')
  .action(async function () {
    console.log("write edges...")
    await saveAllEdges("edges.json", true)
  })




program.parse(process.argv)

var NO_COMMAND_SPECIFIED = program.args.length === 0;
if (NO_COMMAND_SPECIFIED) {
  program.help();
}

