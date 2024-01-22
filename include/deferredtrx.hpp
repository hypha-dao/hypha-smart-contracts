#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;

// Define the smart contract class
class deferredtrx : public contract {
public:
    using contract::contract;

    // Define a structure to store the data for the testdtrx table
    struct testdtrx_data {
        uint64_t id;
        uint64_t number;
        std::string text;

        uint64_t primary_key() const { return id; }
    };

    // Create a multi_index table for the testdtrx table
    typedef multi_index<"testdtrx"_n, testdtrx_data> testdtrx_table;

    // Define a structure to store the data
    struct action_data {
        uint64_t id;
        eosio::time_point_sec execute_time;
        permission_level auth;
        name account;
        name action_name;
        std::vector<char> data;

        uint64_t primary_key() const { return id; }
        uint64_t by_execute_time() const { return execute_time.sec_since_epoch(); }

    };

    // Create a multi_index table with the defined structure and a custom comparator for execute_time
    typedef multi_index<"actions"_n, action_data,
        indexed_by<"bytime"_n, const_mem_fun<action_data, uint64_t, &action_data::by_execute_time>>
    > actions_table;

    // Action to add a new entry to the table
    
    /// Note: Action data is expected to be packed already
    ///
    /// use make tuple (var1, var2, var3, ... ) like so:
    /// value = make_tuple(x, y, x);
    ///
    /// Then use "pack" like so:     
    //std::vector<char> data = pack(std::forward<T>(value));

    [[eosio::action]]
    void addaction(time_point_sec execute_time, permission_level auth, name account, name action_name, std::vector<char> packed_data);

    // Action to execute the stored action based on id
    // [[eosio::action]]
    // void executeactn(uint64_t id);

    // Action to choose and execute the next action
    [[eosio::action]]
    void executenext();


    // Action for testing deferred actions
    [[eosio::action]]
    void testdtrx(uint64_t number, std::string text);

};
