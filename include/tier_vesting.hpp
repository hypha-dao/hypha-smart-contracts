#include <eosio/asset.hpp>
#include <eosio/eosio.hpp>
#include <eosio/time.hpp>
#include <eosio/name.hpp>
#include <eosio/transaction.hpp>
#include "utils.hpp"

using namespace eosio;

class [[eosio::contract]] tier_vesting : public contract {
public:
  using contract::contract;

  [[eosio::action]]
  void addtier(name tier_id, asset amount, std::string name);

  [[eosio::action]]
  void removetier(name tier_id);

  [[eosio::action]]
  void release(name tier_id, asset amount);

  [[eosio::action]]
  void claim(name owner, uint64_t lock_id);

  [[eosio::action]]
  void addlock(name sender, name owner, name tier_id, asset amount, std::string note);

  [[eosio::action]]
  void removelock(uint64_t lock_id);
  
  #ifdef IS_TELOS_TESTNET
    [[eosio::on_notify("mtrwardhypha::transfer")]]
    void onreceive(name from, name to, asset quantity, std::string memo);
  #else
    [[eosio::on_notify("hypha.hypha::transfer")]]
    void onreceive(name from, name to, asset quantity, std::string memo);
  #endif


  [[eosio::action]]
  void reset();

private:
  void send_transfer(name contract, name from, name to, asset quantity, std::string memo);

  struct [[eosio::table]] tier {
    name id;
    std::string name;
    eosio::time_point created_at;
    asset total_amount;
    asset released_amount;
    double percentage_released;

    uint64_t primary_key() const { return id.value; }
  };

  typedef eosio::multi_index<"tiers"_n, tier> tiers_table;

  struct [[eosio::table]] lock {
    uint64_t lock_id;
    name owner;
    name tier_id;
    asset amount;
    asset claimed_amount;
    std::string note;

    uint64_t primary_key() const { return lock_id; }
    uint64_t get_owner() const { return owner.value; }
    uint64_t get_tier_id() const { return tier_id.value; }
  };

  typedef eosio::multi_index<"locks"_n, lock,
    indexed_by<"byowner"_n, const_mem_fun<lock, uint64_t, &lock::get_owner>>,
    indexed_by<"bytier"_n, const_mem_fun<lock, uint64_t, &lock::get_tier_id>>
  > locks_table;

  struct [[eosio::table]] balance {
    name owner;
    asset balance;

    uint64_t primary_key() const { return owner.value; }
  };

  typedef eosio::multi_index<"balances"_n, balance> balances_table;

};
