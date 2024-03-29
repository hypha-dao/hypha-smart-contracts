#pragma once

#include "upvote_election/typed_document.hpp"
#include "upvote_election/macros.hpp"
#include <upvote_election/graph.hpp>

namespace hypha::upvote_election
{

class ElectionRound;

class VoteGroup : public TypedDocument
{
    DECLARE_DOCUMENT(
        Data,
        PROPERTY(round_id, int64_t, RoundID, USE_GET)
    )
public:
    VoteGroup(name dao, uint64_t id);
    VoteGroup(name dao, uint64_t memberId, Data data);

    void castVotes(ElectionRound& round, std::vector<uint64_t> members);
    uint64_t getOwner();

    static std::optional<VoteGroup> getFromRound(name dao, uint64_t roundId, uint64_t memberId);
private:
    virtual const std::string buildNodeLabel(ContentGroups &content) override
    {
        return "Vote Group";
    }
};

using VoteGroupData = VoteGroup::Data;

} // namespace hypha::upvote_election