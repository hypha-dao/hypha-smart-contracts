#pragma once

#include "typed_document.hpp"
#include "macros.hpp"
#include <upvote_election/graph.hpp>

namespace hypha::upvote_election
{

class ElectionRound;

class UpvoteElection : public TypedDocument
{
    DECLARE_DOCUMENT(
        Data,
        PROPERTY(start_date, eosio::time_point, StartDate, USE_GETSET),
        PROPERTY(end_date, eosio::time_point, EndDate, USE_GETSET),
        PROPERTY(status, std::string, Status, USE_GETSET),
        PROPERTY(duration, int64_t, Duration, USE_GETSET)
    )
public:
    UpvoteElection(name dao, uint64_t id);
    UpvoteElection(name dao, uint64_t dao_id, Data data);

    static UpvoteElection getUpcomingElection(name dao, uint64_t dao_id);

    uint64_t getDaoID() const;

    std::vector<ElectionRound> getRounds() const;

    //std::unique_ptr<ElectionRound> getStartRound();
    ElectionRound getCurrentRound() const;
    ElectionRound getStartRound() const;
    ElectionRound getChiefRound() const;

    void setStartRound(ElectionRound* startRound) const;
    void setCurrentRound(ElectionRound* currenttRound) const;

    void validate();
private:
    virtual const std::string buildNodeLabel(ContentGroups &content) override
    {
        return "Upvote Election";
    }
};

using UpvoteElectionData = UpvoteElection::Data;

} // namespace hypha::upvote_election