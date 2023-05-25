#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>
#include <eosio/singleton.hpp>


using namespace eosio;

CONTRACT paycpu : public contract {
public:
    using contract::contract;

    ACTION payforcpu(name account);
    ACTION configure(name contractName);

private:
    TABLE nametoid {
        uint64_t id;
        name name;

        uint64_t primary_key() const { return name.value; }
        uint64_t by_id() const { return id; }
    };

    typedef multi_index<"members"_n, nametoid,
        indexed_by<"bydocid"_n, const_mem_fun<nametoid, uint64_t, &nametoid::by_id>>
    > members_table;

    TABLE config {
        name contractName;

        uint64_t primary_key() const { return 0; }
    };

    typedef eosio::singleton<"configs"_n, config> configs_singleton;
    typedef eosio::multi_index<"configs"_n, config> dump_for_configs;

};

EOSIO_DISPATCH(paycpu, (payforcpu)(configure))
