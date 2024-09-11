const updateAuthAction = ({ account, permission, parent, auth }, { actor, perm }) => ({
    account: 'eosio',
    name: 'updateauth',
    authorization: [{
      actor,
      permission: perm,
    }],
    data: {
      account,
      permission,
      parent,
      auth
    },
  });
  
  module.exports = updateAuthAction;