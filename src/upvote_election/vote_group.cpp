#include <upvote_election/vote_group.hpp>
#include <upvote_election/upvote_common.hpp>
#include <upvote_election/election_round.hpp>
// #include <upvote_election/graph.hpp>

#include <upvote.hpp>


namespace hypha::upvote_election {

using namespace upvote_election::common;

VoteGroup::VoteGroup(name dao, uint64_t id)
    : TypedDocument(dao, id, types::ELECTION_VOTE_GROUP)
{}

VoteGroup::VoteGroup(name dao, uint64_t memberId, Data data)
    : TypedDocument(dao, types::ELECTION_VOTE_GROUP)
{
    auto cgs = convert(std::move(data));

    initializeDocument(dao, cgs);

    Edge(
        getDao(),
        getDao(),
        memberId,
        getId(),
        links::ELECTION_GROUP
    );

    Edge(
        getDao(),
        getDao(),
        //memberId,
        getId(),
        getRoundID(),
        links::ROUND
        //name(getRoundID())
    );
}

uint64_t VoteGroup::getOwner()
{
    return Edge::getTo(
        getDao(), 
        getId(), 
        links::ELECTION_GROUP
    ).getFromNode();
}

std::optional<VoteGroup> VoteGroup::getFromRound(name dao, uint64_t roundId, uint64_t memberId)
{
    auto groups = getGraph().getEdgesFrom(memberId, common::links::ELECTION_GROUP);

    for (auto& group : groups) {
        if (Edge::exists(dao, group.getToNode(), roundId, links::ROUND)) {
            return VoteGroup(dao, group.getToNode());
        }
    }

    return std::nullopt;
}

void VoteGroup::castVotes(ElectionRound& round, std::vector<uint64_t> members)
{
    auto roundId = getRoundID();
    auto power = round.getAccountPower(getOwner());

    eosio::check(
        roundId == round.getId(),
        "Missmatch between stored round id and round parameter"
    );

    auto contract = getDao();

    //We need to first erase previous votes if any
    auto prevVotes = getGraph().getEdgesFrom(getId(), links::VOTE);

    upvote::election_vote_table elctn_t(contract, roundId);

    for (auto& edge : prevVotes) {
        auto memId = edge.getToNode();
        auto voteEntry = elctn_t.get(memId, "Member entry doesn't exists");
        elctn_t.modify(voteEntry, get_self(), [&](upvote::ElectionVote& vote){
            vote.total_amount -= power;
        });
        edge.erase();
    }

    for (auto memId : members) {
        //Verify member is a candidate
        eosio::check(
            round.isCandidate(memId),
            "Member must be a candidate to be voted"
        );

        auto voteIt = elctn_t.find(memId);

        if (voteIt != elctn_t.end()) {
            elctn_t.modify(voteIt, get_self(), [&](upvote::ElectionVote& vote){
                vote.total_amount += power;
            });
        }
        else {
            elctn_t.emplace(contract, [&](upvote::ElectionVote& vote){
                vote.total_amount += power;
                vote.account_id = memId;
            });
        }

        Edge(
            contract,
            contract,
            getId(),
            memId,
            links::VOTE
        );
    }
}

}

