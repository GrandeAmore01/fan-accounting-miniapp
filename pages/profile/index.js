const storageService = require('../../services/storageService');

Page({
  data: {
    profile: {
      nickname: '本地用户',
      loginStatus: false
    },
    counts: {
      expenses: 0,
      budgets: 0,
      userCollections: 0,
      userStages: 0
    }
  },

  onShow() {
    const userData = storageService.readUserData('local-user');
    this.setData({
      profile: userData.profile,
      counts: {
        expenses: userData.expenses.length,
        budgets: userData.budgets.length,
        userCollections: userData.userCollections.length,
        userStages: userData.userStages.length
      }
    });
  }
});
