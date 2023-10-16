#include <document_graph/edge.hpp>

#include <upvote_election/upvote_election.hpp>
#include <upvote_election/upvote_common.hpp>
#include <upvote_election/election_round.hpp>
#include <upvote.hpp>

// #include <dao.hpp>

namespace hypha::upvote_election {

using namespace upvote_election::common;
using namespace eosio;

UpvoteElection::UpvoteElection(name dao, uint64_t id)
    : TypedDocument(dao, id, types::UPVOTE_ELECTION)
{}

static void validateStartDate(const time_point& startDate)
{
    //Only valid if start date is in the future
    eosio::check(
        startDate > eosio::current_time_point(),
        "Election start date must be in the future"
    );
}

static void validateEndDate(const time_point& startDate, const time_point& endDate)
{
    //Only valid if start date is in the future
    // eosio::check(
    //     endDate > startDate,
    //     to_str("End date must happen after start date: ", startDate, " to ", endDate)
    // ); // TODO
    eosio::check(
        endDate > startDate,
        "End date must happen after start date"
    );
}

UpvoteElection::UpvoteElection(name dao, uint64_t dao_id, Data data)
    : TypedDocument(dao, types::UPVOTE_ELECTION)
{
    auto cgs = convert(std::move(data));

    initializeDocument(dao, cgs);

    validate();

    //Also check there are no ongoing elections
    //TODO: Might want to check if there is an ongoing election, it will
    //finish before the start date so then it is valid
    
    // TODO
    eosio::check(
        hypha::getGraph().getEdgesFrom(dao_id, links::ONGOING_ELECTION).empty(),
        "There is an ongoing election for this DAO"
    );

    //Validate that there are no other upcoming elections
    eosio::check(
        getGraph().getEdgesFrom(dao_id, links::UPCOMING_ELECTION).empty(),
        "DAOs can only have 1 upcoming election"
    );

    Edge(
        getDao(),
        getDao(),
        getId(),
        dao_id,
        hypha::common::DAO
    );

    Edge(
        getDao(),
        getDao(),
        dao_id,
        getId(),
        links::ELECTION
    );

    Edge(
        getDao(),
        getDao(),
        dao_id,
        getId(),
        links::UPCOMING_ELECTION
    );
}

uint64_t UpvoteElection::getDaoID() const
{
    return Edge::get(
        getDao(),
        getId(),
        hypha::common::DAO
    ).getToNode();
}

UpvoteElection UpvoteElection::getUpcomingElection(name dao, uint64_t dao_id)
{
    return UpvoteElection(
        dao,
        Edge::get(dao, dao_id, links::UPCOMING_ELECTION).getToNode()
    );
}

std::vector<ElectionRound> UpvoteElection::getRounds() const
{
    std::vector<ElectionRound> rounds;
    
    auto start = Edge::get(
        getDao(),
        getId(),
        links::START_ROUND
    ).getToNode();

    rounds.emplace_back(getDao(), start);

    std::unique_ptr<ElectionRound> next;

    while((next = rounds.back().getNextRound())) {
        rounds.emplace_back(getDao(), next->getId());
    }

    eosio::check(
        rounds.size() >= 2,
        "There has to be at least 2 election rounds"
    );

    return rounds;
}

void UpvoteElection::setStartRound(ElectionRound* startRound) const
{
   //TODO: Check if there is no start round already

   Edge(
       getDao(),  
       getDao(),
       getId(),
       startRound->getId(),
       links::START_ROUND
   );
}

void UpvoteElection::setCurrentRound(ElectionRound* currenttRound) const
{
    Edge(
       getDao(),  
       getDao(),
       getId(),
       currenttRound->getId(),
       links::CURRENT_ROUND
   );
}

ElectionRound UpvoteElection::getStartRound() const
{
    return ElectionRound(
        getDao(),
        Edge::get(getDao(), getId(), links::START_ROUND).getToNode()
    );
}

ElectionRound UpvoteElection::getCurrentRound() const
{
    return ElectionRound(
        getDao(),
        Edge::get(getDao(), getId(), links::CURRENT_ROUND).getToNode()
    );
}

ElectionRound UpvoteElection::getChiefRound() const
{
    return ElectionRound(
        getDao(),
        Edge::get(getDao(), getId(), links::CHIEF_ROUND).getToNode()
    );
}

void UpvoteElection::validate() 
{
    auto startDate = getStartDate();
    validateStartDate(startDate);
    validateEndDate(startDate, getEndDate());
}

}