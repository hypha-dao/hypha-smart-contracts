#include "../include/tier_vesting.hpp"

void tier_vesting::addtier(name tier_id, asset amount, std::string name)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Open the tiers table
  tiers_table tiers(get_self(), get_self().value);

  // Ensure the tier doesn't already exist in the table
  auto tier_itr = tiers.find(tier_id.value);
  check(tier_itr == tiers.end(), "Tier already exists");

  // Initialize the created_at with the current time
  auto current_time = eosio::current_time_point();

// TODO: build the total_amount balance by locks so it's always correct and reflecting existing locks

  // Add the tier to the table
  tiers.emplace(get_self(), [&](auto &row) {
    row.id = tier_id;
    row.total_amount = asset(0, amount.symbol);
    row.name = name;
    row.created_at = current_time;
    row.percentage_released = 0.0;
    row.released_amount = asset(0, amount.symbol); 
  });
}

void tier_vesting::release(name tier_id, asset amount)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Validate the input percentage
  // check(percent >= 0.0 && percent <= 100.0, "Percent must be between 0 and 100");

  // Open the tiers table
  tiers_table tiers(get_self(), get_self().value);

  // Find the tier
  auto tier_itr = tiers.find(tier_id.value);
  check(tier_itr != tiers.end(), "Tier not found");

  // check asset
  check(tier_itr->total_amount.symbol == amount.symbol, "incorrect symbol");

  auto new_total_released = tier_itr->released_amount + amount;
  check(new_total_released <= tier_itr->total_amount, "Can't release more than available.");

  // Calculate the percentage released
  double percentage_released;
  if (new_total_released != tier_itr->total_amount)
  {
    percentage_released = (static_cast<double>(new_total_released.amount) / tier_itr->total_amount.amount) * 100;
  }
  else
  {
    percentage_released = 100.0;
  }

  // Update the tier
  tiers.modify(tier_itr, get_self(), [&](auto &row)
               {
    row.released_amount = new_total_released;
    row.percentage_released = percentage_released; });
}

void tier_vesting::claim(name owner, uint64_t lock_id)
{
  // Ensure this action is authorized by the owner
  require_auth(owner);

  // Open the locks table
  locks_table locks(get_self(), get_self().value);

  // Find the lock
  auto lock_itr = locks.find(lock_id);
  check(lock_itr != locks.end(), "Lock not found");

  // Calculate the claimable amount
  asset claimable = lock_itr->amount - lock_itr->claimed_amount;

  // Ensure there is something to claim
  check(claimable.amount > 0, "Nothing to claim");

  // Update the lock
  locks.modify(lock_itr, get_self(), [&](auto &row)
               { row.claimed_amount += claimable; });

  // Find the token contract for this asset symbol
  tokens_table tokens(get_self(), get_self().value);
  auto token_itr = tokens.find(claimable.symbol.raw());
  check(token_itr != tokens.end(), "Token contract not found for this asset symbol");

  // Send the claimed assets to the owner
  send_transfer(token_itr->contract, get_self(), owner, claimable, "Claim from vesting contract");
}

void tier_vesting::addtoken(name token_contract, asset token)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Open the tokens table
  tokens_table tokens(get_self(), get_self().value);

  // Ensure the token doesn't already exist in the table
  auto token_itr = tokens.find(token.symbol.raw());
  check(token_itr == tokens.end(), "Token already exists in the table");

  // Add the token to the table
  tokens.emplace(get_self(), [&](auto &row)
                 {
    row.symbol = token.symbol;
    row.contract = token_contract; });
}

void tier_vesting::addlock(name sender, name owner, name tier_id, asset amount)
{
  // Ensure this action is authorized by the sender
  require_auth(sender);

  // Open the tiers table
  tiers_table tiers(get_self(), get_self().value);

  // Ensure the tier exists
  auto tier_itr = tiers.find(tier_id.value);
  check(tier_itr != tiers.end(), "Tier not found");

  // Ensure the tier has not yet started vesting
  check(tier_itr->released_amount.amount == 0, "Vesting has already started for this tier");

  // Open the balances table
  balances_table balances(get_self(), get_self().value);

  // Check if the sender has sufficient balance
  auto balance_itr = balances.find(sender.value);
  check(balance_itr != balances.end(), "Insufficient balance");

  // Check if the sender's balance is enough to lock the requested amount
  check(balance_itr->balance >= amount, "Insufficient balance to lock this amount");

  // Deduct the amount from the sender's balance
  balances.modify(balance_itr, get_self(), [&](auto &row)
                  { row.balance -= amount; });

  // Open the locks table
  locks_table locks(get_self(), get_self().value);

  // Calculate the new total amount for the tier by adding the lock amount to the existing total amount
  auto new_total_amount = tier_itr->total_amount + amount;

  // Create a new lock
  locks.emplace(sender, [&](auto &row) {
    row.lock_id = locks.available_primary_key();
    row.owner = owner;
    row.tier_id = tier_id;
    row.amount = amount;
    row.claimed_amount = asset(0, amount.symbol); 
  });

      // Update the tier's total amount
  tiers.modify(tier_itr, get_self(), [&](auto &row)
               {
    row.total_amount = new_total_amount;
  });

}

void tier_vesting::removelock(uint64_t lock_id)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Open the locks table
  locks_table locks(get_self(), get_self().value);

  // Find the lock
  auto lock_itr = locks.find(lock_id);
  check(lock_itr != locks.end(), "Lock not found");

  // Remove the lock from the table
  locks.erase(lock_itr);
}

void tier_vesting::removetier(name tier_id)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Open the tiers table
  tiers_table tiers(get_self(), get_self().value);

  // Find the tier
  auto tier_itr = tiers.find(tier_id.value);
  check(tier_itr != tiers.end(), "Tier not found");

  // Remove the tier from the table
  tiers.erase(tier_itr);
}

void tier_vesting::removetoken(symbol token_symbol)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

  // Open the tokens table
  tokens_table tokens(get_self(), get_self().value);

  // Find the token
  auto token_itr = tokens.find(token_symbol.raw());
  check(token_itr != tokens.end(), "Token not found");

  // Remove the token from the table
  tokens.erase(token_itr);
}

void tier_vesting::onreceive(name from, name to, asset quantity, std::string memo)
{
  if (to != get_self())
  {
    return;
  }

  // For now only hypha token is supported - other tokens would need a more elaborate balances table.
  // // Open the tokens table
  // tokens_table tokens(get_self(), get_self().value);

  // // Find the correct token contract for the transferred asset
  // auto token_itr = tokens.find(quantity.symbol.raw());

  // // Ensure the asset is in the tokens table and the transfer comes from the correct contract
  // if (token_itr == tokens.end() || get_sender() != token_itr->contract) {
  //   return;
  // }

  // Open the balances table
  balances_table balances(get_self(), get_self().value);

  // Find the sender's balance or create a new balance
  auto balance_itr = balances.find(from.value);
  if (balance_itr == balances.end())
  {
    balances.emplace(get_self(), [&](auto &row)
                     {
      row.owner = from;
      row.balance = quantity; });
  }
  else
  {
    balances.modify(balance_itr, get_self(), [&](auto &row)
                    { row.balance += quantity; });
  }
}

// ... Other action implementations ...

void tier_vesting::send_transfer(name contract, name from, name to, asset quantity, std::string memo)
{
  action{
      permission_level{from, "active"_n},
      contract,
      "transfer"_n,
      std::make_tuple(from, to, quantity, memo)}
      .send();
}

// ... Other helper method implementations ...
