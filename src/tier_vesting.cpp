#include "../include/tier_vesting.hpp"

void tier_vesting::reset()
{
  require_auth(get_self());
  // check(false, "reset is only active in testing");

  utils::delete_table<tiers_table>(get_self(), get_self().value);
  utils::delete_table<locks_table>(get_self(), get_self().value);
  utils::delete_table<balances_table>(get_self(), get_self().value);
}

void tier_vesting::addtier(name tier_id, asset amount, std::string name)
{
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
  tiers.emplace(get_self(), [&](auto &row)
                {
    row.id = tier_id;
    row.total_amount = asset(0, amount.symbol);
    row.name = name;
    row.created_at = current_time;
    row.percentage_released = 0.0;
    row.released_amount = asset(0, amount.symbol); });
}

void tier_vesting::release(name tier_id, asset amount)
{
  // Ensure this action is authorized by the contract account
  require_auth(get_self());

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

  send_transfer(name("hypha.hypha"), get_self(), owner, claimable, "Claim from vesting contract");
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
  locks.emplace(sender, [&](auto &row)
                {
    row.lock_id = locks.available_primary_key();
    row.owner = owner;
    row.tier_id = tier_id;
    row.amount = amount;
    row.claimed_amount = asset(0, amount.symbol); });

  // Update the tier's total amount
  tiers.modify(tier_itr, get_self(), [&](auto &row)
               { row.total_amount = new_total_amount; });
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

void tier_vesting::onreceive(name from, name to, asset quantity, std::string memo)
{
  if (to != get_self())
  {
    return;
  }

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

void tier_vesting::send_transfer(name contract, name from, name to, asset quantity, std::string memo)
{
  action{
      permission_level{from, "active"_n},
      contract,
      "transfer"_n,
      std::make_tuple(from, to, quantity, memo)}
      .send();
}
