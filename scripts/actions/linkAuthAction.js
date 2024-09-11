const linkAuthAction = ({ account, code, type, requirement }, { actor, permission }) => ({
    account: 'eosio',
    name: 'linkauth',
    authorization: [{
      actor,
      permission,
    }],
    data: {
      account,
      code,
      type,
      requirement
    },
  });
  
  module.exports = linkAuthAction;