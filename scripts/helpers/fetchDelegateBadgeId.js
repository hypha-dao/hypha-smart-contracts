const fetch = require('node-fetch');
const { graphQLEndpoint } = require('../helper');
const fetchGraphQLQuery = require('./fetchGraphQLQuery');
const query = `query {
    queryBadge(filter: { 
      and: [
        { has: system_badgeId_i },
        { details_title_s: {regexp: "/^delegate$/i"} }
      ]
    }) {
      docId
      system_badgeId_i
      details_title_s
    }
  }
  `

//   res: 
//   {
//     "data": {
//       "queryBadge": [
//         {
//           "docId": "45439",
//           "system_badgeId_i": 6,
//           "details_title_s": "Delegate"
//         }
//       ]
//     },
//     "extensions": {
//       "touched_uids": 280
//     }
//   }

const fetchDelegateBadgeId = async () => {
    const parsedResponse = await fetchGraphQLQuery(query)

  // console.log("fetchDelegateBadgeId " + JSON.stringify(parsedResponse, null, 2))

    const badgesRes = parsedResponse["data"]["queryBadge"]
    //console.log("badgesRes " + JSON.stringify(badgesRes, null, 2))

    if (badgesRes.length == 0) {
        throw "no badge " + JSON.stringify(parsedResponse, null, 2)
    }
    if (badgesRes.length > 1) {
        throw "too many badges " + JSON.stringify(parsedResponse, null, 2)
    }
    return badgesRes[0]["docId"]
}

module.exports = fetchDelegateBadgeId

