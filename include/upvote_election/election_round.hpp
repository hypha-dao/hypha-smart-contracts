#pragma once

#include <optional>

#include "./typed_document.hpp"

#include "./macros.hpp"

namespace hypha::upvote_election
{

class UpvoteElection;

class ElectionRound : public TypedDocument
{
    DECLARE_DOCUMENT(
        Data,
        PROPERTY(type, std::string, Type, USE_GET),
        PROPERTY(start_date, eosio::time_point, StartDate, USE_GET),
        PROPERTY(end_date, eosio::time_point, EndDate, USE_GET),
        PROPERTY(duration, int64_t, Duration, USE_GET),
        PROPERTY(delegate_power, int64_t, DelegatePower, USE_GET),
        PROPERTY(passing_count, int64_t, PassingCount, USE_GET)
        //PROPERTY(round_id, int64_t, RoundId, USE_GET)
    )
public:
    ElectionRound(name dao, uint64_t id);
    ElectionRound(name dao, uint64_t election_id, Data data);

    UpvoteElection getElection();

    std::vector<uint64_t> getWinners();

    void setNextRound(ElectionRound* nextRound) const;
    std::unique_ptr<ElectionRound> getNextRound() const;
    int64_t getAccountPower(uint64_t accountId);
    bool isCandidate(uint64_t accountId);
    void addCandidate(uint64_t accountId);
    
private:
    virtual const std::string buildNodeLabel(ContentGroups &content) override
    {
        return "Election Round";
    }
};

using ElectionRoundData = ElectionRound::Data;

} // namespace hypha::upvote_election