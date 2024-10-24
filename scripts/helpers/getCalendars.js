const fetchGraphQLQuery = require('./fetchGraphQLQuery');
const query = `query MyQuery {
  queryDao {
    docId
    calendar {
      docId
      start {
        docId
        details_startTime_t
        system_readableStartTime_s
        system_readableStartDate_s
      }
      end {
        docId
        details_startTime_t        
        system_readableStartTime_s
        system_readableStartDate_s

      }
    }
  }
}
  `

const getCalendars = async () => {
    const parsedResponse = await fetchGraphQLQuery(query)

    console.log("getCalendars output" + JSON.stringify(parsedResponse, null, 2))

    console.log("TODO: get root DAO query perhaps? - Analyze which DAOs have which calendars.")


}

module.exports = getCalendars

