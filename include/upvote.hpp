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
    using DocumentGraph = hypha::DocumentGraph;

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

    [[eosio::action]]
    void importelct(uint64_t dao_id, bool deferred);

private:

    void createRounds(name dao, UpvoteElection& election, std::map<int64_t, ElectionRoundData>& rounds, time_point startDate, time_point endDate);
    void scheduleElectionUpdate(name dao, UpvoteElection& election, time_point date);
    void assignDelegateBadges(name dao, uint64_t daoId, uint64_t electionId, const std::vector<uint64_t>& chiefDelegates, std::optional<uint64_t> headDelegate, eosio::transaction* trx = nullptr);
    std::map<int64_t, ElectionRoundData> getRounds(ContentGroups& electionConfig, time_point& endDate);
    uint64_t getUniqueTxId();
    uint64_t getRootID();
    void verifyDaoType(uint64_t daoID);
    void checkAdminsAuth(uint64_t daoID);
    uint64_t getMemberID(const name& memberName);

    name getDaoName() {
        // TODO: Make this configurable, maybe in a table etc
        return "dao.hypha"_n;
    }

    hypha::DocumentGraph getGraph() {
        return hypha::DocumentGraph(getDaoName());
    }

    int64_t getDelegatePower(int64_t roundId) {
        return roundId * 1 << roundId;  
    }


    // unique IDs for deferred actions
    TABLE counter {
        uint64_t key;   // Primary key
        uint64_t count; // Counter value

        uint64_t primary_key() const { return key; }
    };

    typedef multi_index<"counters"_n, counter> counter_table;

    counter_table counters;

      TABLE ElectionVote
      {
         uint64_t account_id;
         //uint64_t round_id;
         uint64_t total_amount; 
         uint64_t primary_key() const { return account_id; }
         uint64_t by_amount() const { return total_amount; }
      };

      typedef multi_index<name("electionvote"), ElectionVote,
                          eosio::indexed_by<name("byamount"),
                          eosio::const_mem_fun<ElectionVote, uint64_t, &ElectionVote::by_amount>>>
              election_vote_table;


    // external table definitions
    TABLE NameToID {
        uint64_t id;
        eosio::name name;
        uint64_t primary_key() const { return name.value; }
        uint64_t by_id() const { return id; }
    };

    typedef eosio::multi_index<eosio::name("daos"), NameToID,
                            eosio::indexed_by<eosio::name("bydocid"),
                            eosio::const_mem_fun<NameToID, uint64_t, &NameToID::by_id>>>
            dao_table;

    /// This table definition is from dao.hypha
    // TABLE MemberToId {
    //     uint64_t id;
    //     name name;

    //     uint64_t primary_key() const { return name.value; }
    //     uint64_t by_id() const { return id; }
    // };
    typedef eosio::multi_index<eosio::name("members"), NameToID,
                            eosio::indexed_by<eosio::name("bydocid"),
                            eosio::const_mem_fun<NameToID, uint64_t, &NameToID::by_id>>>
            members_table;

};
