const eosjs = require('eosjs');
const { duration } = require('moment');
const { Serialize } = eosjs

const createTime = (minutes) => {
    let time = new Date();
    time.setTime(time.getTime() + (minutes * 60 * 1000));
    return time
}

const createUpvoteElectionAction = ({
    daoContract,
    daoOwnerAccount,
    daoId,
    electionTime, 
    upvote_duration = 2400,
    duration = 600,
}) => {

    const timeString = Serialize.timePointSecToDate(electionTime.getTime()/1000)

    console.log("time: " + timeString)

    return {
        "account": daoContract,
        "name": "createupvelc",
        "authorization": [{
            "actor": daoOwnerAccount,
            "permission": "active"
        }
        ],
        "data": {
            "dao_id": daoId,
            "election_config": [
                [
                    {
                        "label": "content_group_label",
                        "value": [
                            "string",
                            "details"
                        ]
                    },
                    {
                        "label": "upvote_start_date_time",
                        "value": [
                            "time_point",
                            timeString
                        ]
                    },
                    {
                        "label": "upvote_duration",
                        "value": [
                            "int64",
                            2400
                        ]
                    },
                    {
                        "label": "duration",
                        "value": [
                            "int64",
                            600
                        ]
                    }
                ]
            ]
        }
        ,
    }
}
const data = {
    "dao_id": 42528,
    "election_config": [
        [
            {
                "label": "content_group_label",
                "value": [
                    "string",
                    "details"
                ]
            },
            {
                "label": "upvote_start_date_time",
                "value": [
                    "time_point",
                    "2023-10-19T13:40:00.000"
                ]
            },
            {
                "label": "upvote_duration",
                "value": [
                    "int64",
                    2400
                ]
            },
            {
                "label": "duration",
                "value": [
                    "int64",
                    600
                ]
            }
        ]
    ]
}

module.exports = { createTime, createUpvoteElectionAction }
