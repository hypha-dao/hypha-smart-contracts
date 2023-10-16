
// cleost push action mtdhoxhyphaa uesubmitseed '{
//     "dao_id": 42350,
//     "seed": "0000000000000000000123c7fc247b1179cb3e908781a94ad9eea1ea28ac42b8",
//     "account": "mtdhoxhyphaa"
// }' -p mtdhoxhyphaa@active

const setSeedAction = ({daoContract, daoId, membername, seed}) => {
    return {
        "account": `"${daoContract}"`,
        "name": "uesubmitseed",
        "authorization": [{
            "actor": `"${membername}"`,
            "permission": "active"
        }
        ],
        "data": {
            "dao_id": `${daoId}`,
            "seed": `${seed}`,
            "account": `"${membername}"`
        },
    }
}