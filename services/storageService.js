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

function getUserKey(userId) {
  return `${USER_PREFIX}${userId || 'local-user'}`;
}

function readUserData(userId) {
  const key = getUserKey(userId);
  const cached = wx.getStorageSync(key);
  if (!cached) {
    return { ...DEFAULT_USER_DATA };
  }
  return {
    ...DEFAULT_USER_DATA,
    ...cached
  };
}

function writeUserData(userId, data) {
  wx.setStorageSync(getUserKey(userId), {
    ...DEFAULT_USER_DATA,
    ...data
  });
}

function initUserStorage(userId) {
  const key = getUserKey(userId);
  if (!wx.getStorageSync(key)) {
    wx.setStorageSync(key, { ...DEFAULT_USER_DATA });
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

module.exports = {
  initUserStorage,
  readUserData,
  writeUserData,
  getCollection,
  setCollection
};
