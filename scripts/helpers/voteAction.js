const voteAction = (daoContract, roundId, groupId, membername, votingForId) => {
    return {
        "account": `"${daoContract}"`,
        "name": "castupvote",
        "authorization": [{
            "actor": `"${membername}"`,
            "permission": "active"
        }
        ],
        "data": {
            "round_id": `${roundId}`,
            "group_id": `${groupId}`,
            "voter": `"${membername}"`,
            "voted_id": `${votingForId}`
        },
    }
}