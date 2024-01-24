#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/singleton.hpp>
#include "utils.hpp"

using namespace eosio;

// Define the smart contract class
CONTRACT deferredtrx : public contract {
public:
    using contract::contract;
    deferredtrx(name receiver, name code, datastream<const char*> ds)
      : contract(receiver, code, ds)
        {}

    // Action to add a new entry to the table
    
    /// Note: Action data is expected to be packed already
    ///
    /// use make tuple (var1, var2, var3, ... ) like so:
    /// value = make_tuple(x, y, x);
    ///
    /// Then use "pack" like so:     
    //std::vector<char> data = pack(std::forward<T>(value));

    [[eosio::action]]
    void addaction(time_point_sec execute_time, std::vector<permission_level> auth, name account, name action_name, std::vector<char> packed_data);

    // Action to execute the stored action based on id
    // [[eosio::action]]
    // void executeactn(uint64_t id);

    // Action to choose and execute the next action
    [[eosio::action]]
    void executenext();

    // TEST deftrx

    [[eosio::action]]
    void addtest(time_point_sec execute_time, uint64_t number, std::string text);

    [[eosio::action]]
    void testdtrx(uint64_t number, std::string text);

    [[eosio::action]]
    void reset();

private: 
        
    void schedule_deferred_action(eosio::time_point_sec execute_time, eosio::action action);

    // Define a structure to store the data for the testdtrx table
    TABLE testdtrx_table {
        uint64_t id;
        uint64_t number;
        std::string text;

        uint64_t primary_key() const { return id; }
    };

    // Create a multi_index table for the testdtrx table
    typedef multi_index<"testdtrx"_n, testdtrx_table> testdtrx_tables;

    // Define a structure to store the data
    TABLE deferred_actions_table {
        uint64_t id;
        eosio::time_point_sec execute_time;
        std::vector<permission_level> auth;
        name account;
        name action_name;
        std::vector<char> data;

        uint64_t primary_key() const { return id; }
        uint64_t by_execute_time() const { return execute_time.sec_since_epoch(); }

    };

    // Create a multi_index table with the defined structure and a custom comparator for execute_time
    typedef multi_index<"defactions"_n, deferred_actions_table,
        indexed_by<"bytime"_n, const_mem_fun<deferred_actions_table, uint64_t, &deferred_actions_table::by_execute_time>>
    > deferred_actions_tables;


};
