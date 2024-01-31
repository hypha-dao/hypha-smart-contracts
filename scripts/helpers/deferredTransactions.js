const { eos, names, getTableRows, isLocal } = require('../helper')
const eosjs = require('eosjs')
const { Serialize } = eosjs

const getEosDateString = (secondsFromNow) => {
  const currentDate = new Date();
  const unixTimestamp = Math.floor(currentDate.getTime() / 1000);
  const result = Serialize.timePointSecToDate(unixTimestamp + parseInt(secondsFromNow))
  return result
}

const checkTimeToExecute = async (daoContract) => {
    const getDeferred = async () => await eos.getTableRows({
        code: daoContract,
        scope: daoContract,
        table: 'defactions',
        index_position: '2',          // Use the secondary index
        key_type: 'i64',              // The type of the secondary index
        limit: 3,                    
        reverse: false,          // Fetch in ascending order
        json: true,
      })
      const res = await getDeferred()
    
      // console.log("result: " + JSON.stringify(res, null, 2))

      if (res.rows.length > 0) {
        const unixTimestamp = Math.floor(new Date().getTime() / 1000);
        const execTime = Serialize.dateToTimePointSec(res.rows[0].execute_time)
        // console.log("current time: " + unixTimestamp)
        // console.log("exec time: " + execTime)
        // console.log("res: " + (execTime < unixTimestamp))

        return execTime < unixTimestamp

      } else {
        return false
      }


}

module.exports = { getEosDateString, checkTimeToExecute }



