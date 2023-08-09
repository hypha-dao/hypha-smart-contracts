#pragma once
#include <eosio/eosio.hpp>

using namespace eosio;
using std::string;

namespace utils {

  template <typename T>
  inline void delete_table (const name & code, const uint64_t & scope) {

    T table(code, scope);
    auto itr = table.begin();

    while (itr != table.end()) {
      itr = table.erase(itr);
    }

  }

}


