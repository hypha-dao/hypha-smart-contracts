/// startDate: a JS Date object for start date
module.exports = getUpvoteElectionDoc = (startDate = new Date()) => {
    // create an upvote election
    let time = startDate.toISOString()
 
    //console.log("up elec: " + time)
 
    // NOTE: The date string is "2023-10-03T03:39:53.250Z" but for some reason
    // eosjs insists of appending a 'Z' so we have to remove the Z first.
    if (time.endsWith("Z")) {
       time = time.slice(0, -1)
    }
    
    return JSON.parse(`[
    [
        { "label": "content_group_label", "value": ["string", "details"] },
        { "label": "upvote_start_date_time", "value": ["time_point", "${time}"] },
        { "label": "upvote_duration", "value": ["int64", 600] },
        { "label": "duration", "value": ["int64", 600] }
    ]
    ]`)
 }
 