#pragma once 

#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>

#include <vector>

#include <graph_common.hpp>
#include <document_graph/content.hpp>
#include <document_graph/document.hpp>
#include <document_graph/edge.hpp>
#include <document_graph/util.hpp>
#include <document_graph/content_wrapper.hpp>
#include <document_graph/document_graph.hpp>

#include <upvote_election/upvote_election.hpp>
#include <upvote_election/election_round.hpp>
#include <upvote_election/vote_group.hpp>
#include <upvote_election/typed_document.hpp>
#include <upvote_election/graph.hpp>

#include <upvote_election/macros.hpp>

using namespace hypha::upvote_election;
using namespace hypha;
class [[eosio::contract]] upvote : public eosio::contract {
public:
    using eosio::contract::contract;

    upvote(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds),
        counters(receiver, receiver.value)
        {}

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

    [[eosio::action]]
    void test();

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



    // 
    // external table definitions
    // These are defined in the dao contract
    //
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

    TABLE MemberToId {
        uint64_t id;
        name name;

        uint64_t primary_key() const { return name.value; }
        uint64_t by_id() const { return id; }
    };
    typedef eosio::multi_index<eosio::name("members"), MemberToId,
                            eosio::indexed_by<eosio::name("bydocid"),
                            eosio::const_mem_fun<MemberToId, uint64_t, &MemberToId::by_id>>>
            members_table;

};
