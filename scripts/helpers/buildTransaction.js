const { Serialize } = require('eosjs')
const util = require('util')
const zlib = require('zlib')
const { SigningRequest } = require("eosio-signing-request")
const { eos, eos_testnet } = require('./eosHelper')

const textEncoder = new util.TextEncoder()
const textDecoder = new util.TextDecoder()

const opts = {
    textEncoder,
    textDecoder,
    zlib: {
        deflateRaw: (data) => new Uint8Array(zlib.deflateRawSync(Buffer.from(data))),
        inflateRaw: (data) => new Uint8Array(zlib.inflateRawSync(Buffer.from(data))),
    },
    abiProvider: {
        getAbi: async (account) => (await eos.getAbi(account))
    }
}

const opts_testnet = {
    textEncoder,
    textDecoder,
    zlib: {
        deflateRaw: (data) => new Uint8Array(zlib.deflateRawSync(Buffer.from(data))),
        inflateRaw: (data) => new Uint8Array(zlib.inflateRawSync(Buffer.from(data))),
    },
    abiProvider: {
        getAbi: async (account) => (await eos_testnet.getAbi(account))
    }
}

async function buildTransaction(actions, isTestnet = false) {
    const eos_active = isTestnet ? eos_testnet : eos
    const rpc_active = eos_active.rpc
    const opts_active = isTestnet ? opts_testnet : opts
    const info = await rpc_active.get_info();
    const head_block = await rpc_active.get_block(info.last_irreversible_block_num);
    const chainId = info.chain_id;
    // set to an hour from now.
    const expiration = Serialize.timePointSecToDate(Serialize.dateToTimePointSec(head_block.timestamp) + 3600)
    const transaction = {
        expiration,
        ref_block_num: head_block.block_num & 0xffff, // 
        ref_block_prefix: head_block.ref_block_prefix,
        max_net_usage_words: 0,
        delay_sec: 0,
        context_free_actions: [],
        actions: actions,
        transaction_extensions: [],
        signatures: [],
        context_free_data: []
    };
    // console.log("create esr.. " + JSON.stringify(transaction, null, 2))
    const request = await SigningRequest.create({ transaction, chainId }, opts_active);
    const uri = request.encode();
    return uri
}

module.exports = buildTransaction