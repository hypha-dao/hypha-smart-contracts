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
  void addtier(name tier_id, asset total_amount, std::string name);

  [[eosio::action]]
  void removetier(name tier_id);

  [[eosio::action]]
  void release(name tier_id, asset amount);

  [[eosio::action]]
  void claim(name owner, uint64_t lock_id);

  [[eosio::action]]
  void addlock(name sender, name owner, name tier_id, asset amount);

  [[eosio::action]]
  void removelock(uint64_t lock_id);

  [[eosio::action]]
  void addtoken(name token_contract, asset token);

  [[eosio::action]]
  void removetoken(symbol token_symbol);
  
  // [[eosio::on_notify("hypha.hypha::transfer")]]
  // void onreceive(name from, name to, asset quantity, std::string memo);

  [[eosio::action]]
  void reset();

  void on_receive(name from, name to, asset quantity, std::string memo);

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
    uint64_t lock_id; // This should be unique across all locks
    name owner;
    name tier_id;
    asset amount;
    asset claimed_amount;

    uint64_t primary_key() const { return lock_id; }
    uint64_t get_owner() const { return owner.value; }
    uint64_t get_tier_id() const { return tier_id.value; }
  };

  typedef eosio::multi_index<"locks"_n, lock,
    indexed_by<"byowner"_n, const_mem_fun<lock, uint64_t, &lock::get_owner>>,
    indexed_by<"bytier"_n, const_mem_fun<lock, uint64_t, &lock::get_tier_id>>
  > locks_table;

  struct [[eosio::table]] token {
    symbol symbol;
    name contract;

    uint64_t primary_key() const { return symbol.raw(); }
  };

  typedef eosio::multi_index<"tokens"_n, token> tokens_table;

  struct [[eosio::table]] balance {
    name owner;
    asset balance;

    uint64_t primary_key() const { return owner.value; }
  };

  typedef eosio::multi_index<"balances"_n, balance> balances_table;


};

extern "C" void apply(uint64_t receiver, uint64_t code, uint64_t action) {
    if (action == name("transfer").value) {
        // Check if the transfer action is from a specific token contract
        if (code == name("tokencontract1").value) {
            // Call the corresponding function to handle tokencontract1 transfers
            execute_action<tier_vesting>(name(receiver), name(code), &tier_vesting::on_receive);
        }
        // Add more if conditions for handling transfers from other token contracts
        // else if (code == name("tokencontract3").value) {
        //    execute_action<vesting_contract>(name(receiver), name(code), &vesting_contract::on_transfer_tokencontract3);
        // }
        // ... and so on
    }
}
