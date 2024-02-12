
const createAccount = require('../../scripts/createAccount')
const { eos, names, getBalance, sleep } = require('../../scripts/helper')
const { documentCache } = require('../docGraph')
const getCreateDaoData = require("../helpers/getCreateDaoData")
const { daoContract, owner, firstuser, seconduser, thirduser, voice_token, husd_token, hyphatoken } = names

// system badges - dao-> badge edges exist

const HEAD_DELEGATE = "headdelegate"
const CHIEF_DELEGATE = "chiefdelegate"

// Badge assignment edge names
const HELD_BY = "heldby";

// Upvote Edge names
const ELECTION_EDGE = "ue.election" // ALL ELECTIONS EVER
const UPCOMING_ELECTION = "ue.upcoming" // CURRENT UPCOMING ELECTION
const ONGOING_ELECTION = "ue.ongoing"
const PREVIOUS_ELECTION = "ue.previous"

const MEMBER = "member"   // DAO --> MEMBER
const MEMBER_OF = "memberof"

const APPLICANT = "applicant"
const APPLICANT_OF = "applicantof"

const START_ROUND = "ue.startrnd"
const CURRENT_ROUND = "ue.currnd"
const ELECTION_ROUND = "ue.round"
const ELECTION_ROUND_MEMBER = "ue.rd.member"
const ELECTION_GROUP_LINK = "ue.group.lnk"
const GROUP_WINNER = "ue.group.win"

const BADGE_NAME = "badge"

NEXT_ROUND = "ue.nextrnd"
// inline constexpr auto ROUND_CANDIDATE = eosio::name("ue.candidate");
// inline constexpr auto ROUND_WINNER = eosio::name("ue.winner");
// inline constexpr auto ELECTION_GROUP = eosio::name("ue.elctngrp");
UP_VOTE_VOTE = "ue.vote"
// inline constexpr auto UPVOTE_GROUP_WINNER = eosio::name("ue.winner");
// inline constexpr auto VOTE = eosio::name("vote"); // ?? 

const devKeyPair = {
    private: "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",  // local dev key
    public: "EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV"
 }
 const newAccountPublicKey = devKeyPair.public
 

const runAction = async ({ contractName = "dao.hypha", action, data, actor }) => {
    actor = actor ?? contractName

    return eos.api.transact({
        actions: [{
            account: contractName,
            name: action,
            authorization: [{
                actor: actor,
                permission: 'active',
            }],
            data: data,
        }]
    }, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}

const Types = {
    Int: 'int64',
    String: 'string',
    Checksum: 'checksum256',
    Asset: 'asset',
    Name: 'name',
    TimePoint: 'time_point',
}

const setSetting = async (setting, value) => {
    return runAction({
        action: 'setsetting', data: {
            key: setting,
            value,
            group: null
        }
    });
}

const initializeDHO = async () => {

    result = await setSetting('governance_token_contract', [Types.Name, voice_token]);

    result = await setSetting('reward_token_contract', [Types.Name, hyphatoken]);

    result = await setSetting('peg_token_contract', [Types.Name, husd_token]);

    result = await setSetting('treasury_contract', [Types.Name, 'mttrsryhypha']);

    result = await setSetting('period_duration_sec', [Types.Int, 604800]);

    result = await setSetting('next_schedule_id', [Types.Int, parseInt(Math.random() * 1000000)]);

    result = await setSetting('init_period_count', [Types.Int, 10]); // optional - will use 30 if not set

    await sleep(1000);
}

const getMemberName = (memberId) => {
    const contentGroups = documentCache[memberId]["content_groups"]
    const contentGroup = getContentGroup("details", contentGroups)
    const memberName = getValueFromContentGroup("member", contentGroup)
    return memberName
}

const getDelegates = (daoObj, doOneHeadDelegateCheck = true) => {
    const chiefDelegatesEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, CHIEF_DELEGATE)
    const headDelegateEdges = findEdgesByFromNodeAndEdgeName(daoObj.id, HEAD_DELEGATE)

    if (headDelegateEdges.length != 1) {
        throw "only one head delegate " + headDelegateEdges.length
    }

    return {
        chiefDelegates: chiefDelegatesEdges.map((edge) => edge.to_node),
        headDelegate: headDelegateEdges[0].to_node
    }
}

// Now we do some voting in our groups
const getContentGroup = (label, contentArr) => {
    // we expect there to be an array of arrays
    for (arr of contentArr) {
        for (obj of arr) {
            if (obj.label == "content_group_label") {
                if (obj.value[1] == label) {
                    return arr
                }
            }
        }
    }
}
const getValueFromContentGroup = (label, contentGroup) => {
    // a content group is an array of label/value pairs, where value is an array size 2 [type, value]
    for (obj of contentGroup) {
        if (obj.label == label) {
            return obj.value[1]
        }
    }
}
const randomAccountName = () => {
    let length = 12
    var result = '';
    var characters = 'abcdefghijklmnopqrstuvwxyz1234';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const createMultipleAccounts = async (num) => {
    let result = []

    for (let i = 0; i < num; i++) {
        const member = randomAccountName()

        await createAccount({
            account: member,
            publicKey: newAccountPublicKey,
            creator: owner
        })

        result.push(member)
    }
    return result
}

const getLastDocuments = async (num, contractName) => {
    const data = await eos.getTableRows({
        code: contractName,
        scope: contractName,
        table: 'documents',
        limit: num,
        reverse: true,
        json: true,
    });
    return data.rows;
};

/// Init the dao contract with basic data
//
// Create a root document
// Create badges
// initializeDHO - set initial settings
// Create a calendar
//
async function initAllDHOSettings(contract, contractName) {
    console.log("create root " + contractName);
    await contract.createroot('test root', { authorization: `${contractName}@active` });
    const docs = await getLastDocuments(5, contractName);

    console.log("badges initialized ");
    const delegateBadge = docs.find(item => JSON.stringify(item.content_groups).indexOf("Upvote Delegate Badge") != -1);
    const delegateBadgeId = delegateBadge.id;
    // console.log("delegate badge " + JSON.stringify(delegateBadge, null, 2))
    // console.log("delegate badge id " + delegateBadgeId)
    const hasDelegateBadge = JSON.stringify(docs).indexOf("Upvote Delegate Badge") != -1;

    await sleep(1000);

    // init initial settings
    console.log("set intial settings ");
    await initializeDHO();

    console.log("create calendar ");
    await contract.createcalen(true, { authorization: `${contractName}@active` });
    await sleep(1000);

    const docs2 = await getLastDocuments(30, contractName);
    const startPerString = "Calendar start period";
    const startPeriodDoc = docs2.find(item => JSON.stringify(item.content_groups).indexOf(startPerString) != -1);

    console.log("start period doc " + JSON.stringify(startPeriodDoc));
    return { hasDelegateBadge, startPeriodDoc, delegateBadge };
}

/// =============================================================================
/// Create a new DAO
/// =============================================================================
async function createDAO({contract, contractName, newDaoName, daoOwnerAccount}) {
    console.log("create dao " + newDaoName + " with owner " + daoOwnerAccount)
    const daoParams = getCreateDaoData({
       dao_name: newDaoName,
       onboarder_account: daoOwnerAccount,
    })

    await contract.createdao(daoParams, { authorization: `${daoOwnerAccount}@active` });
 
    const getDaoEntry = async (daoName) => {
        const accountsTable = await eos.getTableRows({
           code: contractName,
           scope: contractName,
           table: 'daos',
           lower_bound: daoName,
           upper_bound: daoName,
           json: true
        });
        return accountsTable.rows[0];
     };
     
     const daoObj = await getDaoEntry(newDaoName)
     console.log("DAO id: " + daoObj.id + " Name: " + newDaoName)
     
     return daoObj

 }
 


module.exports = {
    initAllDHOSettings,
    createDAO,
    getMemberName,
    MEMBER,
    MEMBER_OF,
    APPLICANT,
    APPLICANT_OF,
    getContentGroup,
    getValueFromContentGroup,
    randomAccountName,
    createMultipleAccounts,
    getLastDocuments,
    newAccountPublicKey,


}