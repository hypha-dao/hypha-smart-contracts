#include "upvote_election/election_round.hpp"

#include <document_graph/edge.hpp>

#include "upvote_election/upvote_common.hpp"

#include "upvote_election/upvote_election.hpp"

#include "dao.hpp"

namespace hypha::upvote_election {

using namespace upvote_election::common;

static void validateStartDate(const time_point& startDate)
{
    //Only valid if start date is in the future
    eosio::check(
        startDate > eosio::current_time_point(),
        "Election start date must be in the future"
    )
}

static void validateEndDate(const time_point& startDate, const time_point& endDate)
{
    //Only valid if start date is in the future
    eosio::check(
        endDate > startDate,
        // to_str("End date must happen after start date: ", startDate, " to ", endDate)
        "End date must happen after start date: to "
    );
}

ElectionRound::ElectionRound(name dao, uint64_t id)
    : TypedDocument(dao, id,  types::ELECTION_ROUND)
{}

ElectionRound::ElectionRound(name dao, uint64_t election_id, Data data)
    : TypedDocument(dao, types::ELECTION_ROUND)
{
    eosio::check(
        data.delegate_power >= 0,
        "Delegate Power must be greater or equal to 0"
    );

    validateStartDate(data.start_date);

    validateEndDate(data.start_date, data.end_date);

    auto cgs = convert(std::move(data));

    initializeDocument(name, cgs);

    auto type = getType();

    if (type == round_types::CHIEF) {
        eosio::check(
            !Edge::getIfExists(dao, election_id, links::CHIEF_ROUND).first,
            "There is another chief delegate round already"
        )


        // TODL: call dao.hypha
        Edge(
            dao,
            dao,
            election_id,
            getId(),
            links::CHIEF_ROUND
        );
    }
    else if (type == round_types::HEAD) {
        eosio::check(
            !Edge::getIfExists(dao, election_id, links::HEAD_ROUND).first,
            "There is another head delegate round already"
        )
        
        // TODL: call dao.hypha
        Edge(
            dao,
            dao,
            election_id,
            getId(),
            links::HEAD_ROUND
        );

        eosio::check(
            getPassingCount() == 1,
            "There can be only 1 Head Delegate"
        )
    }

    // TODL: this creating edge code is probably going to have to be on dao.hypha, and called
    // by executing external action
    Edge(
        dao,
        dao,
        election_id,
        getId(),
        links::ROUND
    );

    // TODL: call dao.hypha
    Edge(
        dao,
        dao,
        getId(),
        election_id,
        links::ELECTION
    );
}

UpvoteElection ElectionRound::getElection() {
    return UpvoteElection(
        getDao(),
        Edge::get(getDao().get_self(), getId(), links::ELECTION).getToNode()
    );
}

std::vector<uint64_t> ElectionRound::getWinners()
{
    std::vector<uint64_t> winners;

    dao::election_vote_table elctn_t(getDao().get_self(), getId());

    auto byAmount = elctn_t.get_index<"byamount"_n>();

    auto beg = byAmount.rbegin();

    auto idx = 0;

    while (idx < getPassingCount() && beg != byAmount.rend()) {
        winners.push_back(beg->account_id);
        ++idx;
        ++beg;
    }

    return winners;
}

void ElectionRound::setNextRound(ElectionRound* nextRound) const
{
    eosio::check(
        !getNextRound(),
        "Election Round already has next round set"
    );

    Edge(
        getDao().get_self(),
        getDao().get_self(),
        getId(),
        nextRound->getId(),
        links::NEXT_ROUND
    );
}

std::unique_ptr<ElectionRound> ElectionRound::getNextRound() const
{
    if (auto [exists, edge] = Edge::getIfExists(getDao().get_self(), getId(), links::NEXT_ROUND);
        exists) {
        return std::make_unique<ElectionRound>(getDao(), edge.getToNode());    
    }
    
    return {};
}

bool ElectionRound::isCandidate(uint64_t accountId)
{
    return Edge::exists(
        getDao().get_self(),
        getId(),
        accountId,
        links::ROUND_CANDIDATE
    );
} 

int64_t ElectionRound::getAccountPower(uint64_t accountId)
{
    if (isCandidate(accountId)) {
        return std::max(int64_t{1}, getDelegatePower());
    }

    return 1;
}

void ElectionRound::addCandidate(uint64_t accountId)
{
    Edge(
        getDao().get_self(),
        getDao().get_self(),
        getId(),
        accountId,
        links::ROUND_CANDIDATE
    );
}

}