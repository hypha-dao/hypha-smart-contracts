const fetchGraphQLQuery = require("./fetchGraphQLQuery");

// {
//     "data": {
//       "getDao": {
//         "docId": "1135",
//         "headdelegate": [],
//         "chiefdelegate": []
//       }
//     },
//     "extensions": {
//       "touched_uids": 5
//     }
//   }
const fetchDaoId = async (daoName) => {
    const query = `query {
        getDao(details_daoName_n: "${daoName}") {
          docId
          headdelegate { docId }
          chiefdelegate { docId }
        }
      }`
    const res = await fetchGraphQLQuery(query)

    //console.log("res: " + JSON.stringify(res, null, 2))

    return res["data"]["getDao"]["docId"]
}

module.exports = fetchDaoId

