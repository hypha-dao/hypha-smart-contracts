#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/singleton.hpp>

using namespace eosio;

CONTRACT paycpu : public contract {
public:
    using contract::contract;

    ACTION payforcpu(name account);
    ACTION configure(name contractName);
    ACTION newacct(name account);


private:

    uint64_t freeAllowance = 5;

    void check_new_member(const eosio::name& account_name);

    /// This table definition is from dao.hypha
    TABLE nametoid {
        uint64_t id;
        name name;

        uint64_t primary_key() const { return name.value; }
        uint64_t by_id() const { return id; }
    };

    typedef multi_index<"members"_n, nametoid,
        indexed_by<"bydocid"_n, const_mem_fun<nametoid, uint64_t, &nametoid::by_id>>
    > members_table;

    /// config table to configure the dao contract
    TABLE config {
        name contractName;

        uint64_t primary_key() const { return 0; }
    };

    typedef eosio::multi_index<"configs"_n, config> configs_table;
    typedef eosio::singleton<"configs"_n, config> configs_singleton;

    /// config table for new users
    TABLE newMembers {
        name name;
        time_point created_at;
        uint32_t used;

        uint64_t primary_key() const { return name.value; }
    };

    typedef multi_index<"newmembers"_n, newMembers> new_members_table;

};

EOSIO_DISPATCH(paycpu, (payforcpu)(configure)(newacct))
