const USER_PREFIX = 'fan_accounting_';

const DEFAULT_USER_DATA = {
  expenses: [],
  budgets: [],
  userCollections: [],
  userStages: [],
  profile: {
    nickname: '本地用户',
    loginStatus: false
  }
};

function createDefaultUserData() {
  return {
    expenses: [],
    budgets: [],
    userCollections: [],
    userStages: [],
    profile: {
      ...DEFAULT_USER_DATA.profile
    }
  };
}

function getUserKey(userId) {
  return `${USER_PREFIX}${userId || 'local-user'}`;
}

function readUserData(userId) {
  const key = getUserKey(userId);
  const cached = wx.getStorageSync(key);
  if (!cached) {
    return createDefaultUserData();
  }
  return {
    ...createDefaultUserData(),
    ...cached,
    profile: {
      ...DEFAULT_USER_DATA.profile,
      ...(cached.profile || {})
    }
  };
}

function writeUserData(userId, data) {
  wx.setStorageSync(getUserKey(userId), {
    ...createDefaultUserData(),
    ...data,
    profile: {
      ...DEFAULT_USER_DATA.profile,
      ...(data.profile || {})
    }
  });
}

function resetUserData(userId) {
  const nextData = createDefaultUserData();
  wx.setStorageSync(getUserKey(userId), nextData);
  return nextData;
}

function initUserStorage(userId) {
  const key = getUserKey(userId);
  if (!wx.getStorageSync(key)) {
    wx.setStorageSync(key, createDefaultUserData());
  }
}

function getCollection(userId, collectionName) {
  const userData = readUserData(userId);
  return userData[collectionName] || [];
}

function setCollection(userId, collectionName, value) {
  const userData = readUserData(userId);
  userData[collectionName] = value;
  writeUserData(userId, userData);
  return value;
}

function getLocalDataSummary(userId) {
  const userData = readUserData(userId);
  return {
    profile: userData.profile,
    counts: {
      expenses: userData.expenses.length,
      budgets: userData.budgets.length,
      userCollections: userData.userCollections.length,
      lightedCollections: userData.userCollections.filter((item) => item.isOwned).length,
      userStages: userData.userStages.length,
      lightedStages: userData.userStages.filter((item) => item.isLighted).length
    },
    hasLocalData:
      userData.expenses.length > 0 ||
      userData.budgets.length > 0 ||
      userData.userCollections.length > 0 ||
      userData.userStages.length > 0
  };
}

function getCloudStatus() {
  return {
    enabled: false,
    loginReady: false,
    databaseReady: false,
    message: '第一阶段使用本地缓存，云开发接口已预留但暂未启用。'
  };
}

module.exports = {
  initUserStorage,
  createDefaultUserData,
  readUserData,
  writeUserData,
  resetUserData,
  getCollection,
  setCollection,
  getLocalDataSummary,
  getCloudStatus
};
