#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/permission.hpp>
#include <eosio/asset.hpp>
#include <abieos_numeric.hpp>

using std::string;
using namespace eosio;
using abieos::authority;
using abieos::keystring_authority;
using std::make_tuple;

CONTRACT joinhypha : public contract {
   public:
      using contract::contract;

      // **Note** This needs to be manually set before deploying to a different chain

      /// Telos
      // asset net_stake = asset(5000, symbol("TLOS", 4)); // 0.5 TLOS
      // asset cpu_stake = asset(5000, symbol("TLOS", 4)); // 0.5 TLOS

      /// EOS
      asset net_stake = asset(1000, symbol("EOS", 4)); // 0.1 EOS
      asset cpu_stake = asset(1000, symbol("EOS", 4)); // 0.1 EOS

      struct [[eosio::table ]] config {
         name                       account_creator_contract   ;
         name                       account_creator_oracle     ;
         std::map<name, uint8_t>    settings                   ;
      };

      typedef singleton<"config"_n, config> config_table;
      typedef multi_index<"config"_n, config> config_table_placeholder;

      struct [[eosio::table]] invite {
         uint64_t                   invite_id;
         uint64_t                   dao_id;
         name                       dao_name;
         string                     dao_fullname;
         name                       inviter;
         checksum256                hashed_secret;

         uint64_t primary_key() const { return invite_id; }
         checksum256 by_hashed_secret() const { return hashed_secret; }
      };

      typedef multi_index<"invites"_n, invite, indexed_by<"byhashed"_n, const_mem_fun<invite, checksum256, &invite::by_hashed_secret>>> invite_table;

      struct [[eosio::table]] kv {
         name                       key;
         std::variant<name, uint64_t, asset, std::string> value;

         uint64_t primary_key() const { return key.value; }
      };

      typedef multi_index<"kv"_n, kv> kv_table;

      ACTION setconfig ( const name& account_creator_contract, const name& account_creator_oracle );
      ACTION setsetting ( const name& setting_name, const uint8_t& setting_value );
      ACTION setkv(const name& key, const std::variant<name, uint64_t, asset, std::string>& value);

      ACTION pause ();
      ACTION activate ();
      
      ACTION create ( const name& account_to_create, const string& key);

      ACTION createinvite(const uint64_t dao_id, const name dao_name, const string dao_fullname, const name inviter, const checksum256 hashed_secret);
      ACTION redeeminvite(const name account, const checksum256 secret);

    private: 
      void create_account(name account, string publicKey);
      std::variant<name, uint64_t, asset, std::string> get_kv(const name& key);

};
