#include <eosio/eosio.hpp>
#include <vector>

#include <graph_common.hpp>
#include <document_graph/content.hpp>
#include <document_graph/document.hpp>
#include <document_graph/edge.hpp>
#include <document_graph/util.hpp>
#include <document_graph/content_wrapper.hpp>
#include <document_graph/document_graph.hpp>

#include "upvote_election/upvote_election.hpp"
#include "upvote_election/election_round.hpp"
#include "upvote_election/vote_group.hpp"
#include "upvote_election/typed_document.hpp"

#include "upvote_election/macros.hpp"

class [[eosio::contract]] upvote : public eosio::contract {
public:
    using eosio::contract::contract;

    using UpvoteElection = hypha::upvote_election::UpvoteElection;
    using UpvoteElectionData = hypha::upvote_election::UpvoteElectionData;
    using ElectionRound = hypha::upvote_election::ElectionRound;
    using ElectionRoundData = hypha::upvote_election::ElectionRoundData;
    using VoteGroup = hypha::upvote_election::VoteGroup;
    using VoteGroupData = hypha::upvote_election::VoteGroupData;
    using ContentGroups = hypha::ContentGroups;

    // A hypothetical ContentGroups data structure. 
    // You would need to provide the exact definition 
    // or include its header if it's defined elsewhere.
    // typedef std::vector<std::pair<std::string, std::string>> ContentGroups;

    [[eosio::action]]
    void createupvelc(uint64_t dao_id, hypha::ContentGroups& election_config);
    
    [[eosio::action]]
    void editupvelc(uint64_t election_id, hypha::ContentGroups& election_config);
    
    [[eosio::action]]
    void cancelupvelc(uint64_t election_id);

    [[eosio::action]]
    void updateupvelc(uint64_t election_id, bool reschedule);
    
    [[eosio::action]]
    void castelctnvote(uint64_t round_id, eosio::name voter, std::vector<uint64_t> voted);

private:

    void createRounds(name dao, UpvoteElection& election, std::map<int64_t, ElectionRoundData>& rounds, time_point startDate, time_point endDate);
    void scheduleElectionUpdate(name dao, UpvoteElection& election, time_point date);
    void assignDelegateBadges(name dao, uint64_t daoId, uint64_t electionId, const std::vector<uint64_t>& chiefDelegates, std::optional<uint64_t> headDelegate, eosio::transaction* trx = nullptr);
    std::map<int64_t, ElectionRoundData> getRounds(ContentGroups& electionConfig, time_point& endDate);
    uint64_t getUniqueTxId();

    // unique IDs for deferred actions
    TABLE counter {
        uint64_t key;   // Primary key
        uint64_t count; // Counter value

        uint64_t primary_key() const { return key; }
    };

    typedef multi_index<"counters"_n, counter> counter_table;

    counter_table counters;

};
