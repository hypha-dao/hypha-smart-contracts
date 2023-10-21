#include <hypha.accountcreator.hpp>

void joinhypha::setconfig ( const name& account_creator_oracle ) {
   require_auth (get_self());

   check ( is_account (account_creator_oracle), "Provided account creator oracle does not exist: " + account_creator_oracle.to_string());

   setkv(oracle_account, account_creator_oracle);
}

void joinhypha::setsetting ( const name& setting_name, const uint8_t& setting_value ) {
   require_auth (get_self());

   config_table      config_s (get_self(), get_self().value);
   config c = config_s.get_or_create (get_self(), config());
   c.settings[setting_name] = setting_value;
   config_s.set(c, get_self());
}

void joinhypha::pause () {
   setsetting ("active"_n, 0);
}

void joinhypha::activate () {
   setsetting ("active"_n, 1);
}

void joinhypha::create ( const name& account_to_create, const string& key) {

   auto oracle_account_value = get_kv(name(oracle_account));
   const name oracle_account_name = std::get<name>(oracle_account_value);

   require_auth (oracle_account_name);

   config_table      config_s (get_self(), get_self().value);
   config c = config_s.get_or_create (get_self(), config());
   uint8_t paused = c.settings[name("active")];
   check (c.settings["active"_n] == 1, "Contract is not active. Exiting.");

   //string prefix { "EOS" };

   print (" Account Creator Oracle   : ", c.account_creator_oracle.to_string(), "\n");

   // print (" Self                       : ", get_self().to_string(), "\n");
   // print (" Owner Key                  : ", owner_key, "\n");
   // print (" Active Key                 : ", active_key, "\n");
   // print (" Prefix                     : ", prefix, "\n");

    create_account(account_to_create, key);

}

void joinhypha::create_account(name account, string publicKey)
{
  if (is_account(account)) {
    check(false, "account exists: ");
  }

  authority auth = keystring_authority(publicKey);

  action(
      permission_level{_self, "active"_n},
      "eosio"_n, "newaccount"_n,
      make_tuple(_self, account, auth, auth))
      .send();

  action(
      permission_level{_self, "active"_n},
      "eosio"_n, 
      "buyrambytes"_n,
      make_tuple(_self, account, 2500)) // 2000 RAM is used by Telos free.tf
      .send();

  action(
      permission_level{_self, "active"_n},
      "eosio"_n, "delegatebw"_n,
      make_tuple(_self, account, net_stake, cpu_stake, 0))
      .send();
   
   // if paycpu is specified, send info there
   kv_table kv(get_self(), get_self().value);
   auto kv_itr = kv.find(paycpu_account.value);
   if (kv_itr != kv.end()) {
      name paycpu_contract = std::get<name>(kv_itr->value);

      action(
         permission_level{paycpu_contract, "newacct"_n},
         paycpu_contract, "newacct"_n,
         make_tuple(account))
         .send();
   }
   
}

ACTION joinhypha::createinvite(const uint64_t dao_id, const name dao_name, const string dao_fullname, const name inviter, const checksum256 hashed_secret) {
   require_auth(inviter);

   // Create a new invite entry
   invite_table invites(get_self(), get_self().value);
   invites.emplace(inviter, [&](auto& row) {
      row.invite_id = invites.available_primary_key();
      row.dao_id = dao_id;
      row.dao_name = dao_name;
      row.dao_fullname = dao_fullname;
      row.inviter = inviter;
      row.hashed_secret = hashed_secret;
   });

   print("Invite created successfully. Invite ID: ", invites.available_primary_key() - 1);
}

ACTION joinhypha::redeeminvite(const name account, const checksum256 secret) {
   require_auth(account);

   // Create hashed_secret from the provided secret
   auto _invite_secret = secret.extract_as_byte_array();
   checksum256 hashed_secret = sha256((const char *)_invite_secret.data(), _invite_secret.size());

   // Lookup the invite from the invite_table using hashed_secret
   invite_table invites(get_self(), get_self().value);
   auto invite_by_hashed_secret = invites.get_index<"byhashed"_n>();
   auto invite_itr = invite_by_hashed_secret.find(hashed_secret);
   check(invite_itr != invite_by_hashed_secret.end(), "Invalid invite");

   // Get the enroller and dao_id from the invite
   const name enroller = invite_itr->inviter;
   const uint64_t dao_id = invite_itr->dao_id;

   // Load the dao contract
   auto dao_contract_value = get_kv(name("dao.contract"));
   const name dao_contract = std::get<name>(dao_contract_value);

   // Call the autoenroll action on the dao.hypha contract
   action(
      permission_level{get_self(), "active"_n},
      dao_contract,
      "autoenroll"_n,
      std::make_tuple(dao_id, enroller, account)
   ).send();

   // Erase the invite from the invites table
   invite_by_hashed_secret.erase(invite_itr);

}

ACTION joinhypha::setkv(const name& key, const std::variant<name, uint64_t, asset, std::string>& value) {
   require_auth(get_self());

   kv_table kv(get_self(), get_self().value);
   auto kv_itr = kv.find(key.value);

   if (kv_itr == kv.end()) {
      kv.emplace(get_self(), [&](auto& row) {
         row.key = key;
         row.value = value;
      });
   } else {
      kv.modify(kv_itr, get_self(), [&](auto& row) {
         row.value = value;
      });
   }
}

std::variant<name, uint64_t, asset, std::string> joinhypha::get_kv(const name& key) {
   kv_table kv(get_self(), get_self().value);
   auto kv_itr = kv.find(key.value);

   check(kv_itr != kv.end(), "Key not found:  " + key.to_string());

   return kv_itr->value;
}

