#pragma once

#include <eosio/eosio.hpp>
#include <eosio/asset.hpp>

using namespace eosio;

CONTRACT paycpu : public contract {
public:
    using contract::contract;

    ACTION payforcpu(name account);

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
    
};

EOSIO_DISPATCH(paycpu, (payforcpu))
