const USER_PREFIX = 'fan_accounting_';
const ACTIVE_USER_KEY = 'fan_accounting_active_user_id';
const AUTH_TOKEN_KEY = 'fan_accounting_auth_token';

const DEFAULT_USER_DATA = {
  expenses: [],
  budgets: [],
  userCollections: [],
  userStages: [],
  stageNotes: [],
  profile: {
    nickname: '本地用户',
    displayName: '微信用户',
    avatarFileId: '',
    avatarUrl: '',
    loginStatus: false
  }
};

function createDefaultUserData() {
  return {
    expenses: [], budgets: [], userCollections: [], userStages: [], stageNotes: [],
    profile: { ...DEFAULT_USER_DATA.profile }
  };
}

function getActiveUserId() {
  return wx.getStorageSync(ACTIVE_USER_KEY) || '';
}

function resolveUserId(userId) {
  const activeUserId = getActiveUserId();
  return (!userId || userId === 'local-user') && activeUserId
    ? activeUserId
    : (userId || 'local-user');
}

function getUserKey(userId) {
  return `${USER_PREFIX}${resolveUserId(userId)}`;
}

function normalizeUserData(data = {}) {
  return {
    ...createDefaultUserData(),
    ...data,
    profile: { ...DEFAULT_USER_DATA.profile, ...(data.profile || {}) }
  };
}

function setActiveUser(userId) {
  const nextUserId = String(userId || '').trim();
  if (!nextUserId) return;
  const targetKey = `${USER_PREFIX}${nextUserId}`;
  const legacyKey = `${USER_PREFIX}local-user`;
  const existing = wx.getStorageSync(targetKey);
  const userData = normalizeUserData(existing || wx.getStorageSync(legacyKey));
  userData.profile = {
    ...userData.profile,
    nickname: userData.profile.nickname === '本地用户' ? '微信用户' : userData.profile.nickname,
    loginStatus: true
  };
  wx.setStorageSync(targetKey, userData);
  wx.setStorageSync(ACTIVE_USER_KEY, nextUserId);
}

function readUserData(userId) {
  return normalizeUserData(wx.getStorageSync(getUserKey(userId)));
}

function writeUserData(userId, data) {
  wx.setStorageSync(getUserKey(userId), normalizeUserData(data));
}

function resetUserData(userId) {
  const nextData = createDefaultUserData();
  if (getActiveUserId()) {
    nextData.profile = { nickname: '微信用户', loginStatus: true };
  }
  wx.setStorageSync(getUserKey(userId), nextData);
  return nextData;
}

function initUserStorage(userId) {
  const key = getUserKey(userId);
  if (!wx.getStorageSync(key)) wx.setStorageSync(key, createDefaultUserData());
}

function getCollection(userId, collectionName) {
  return readUserData(userId)[collectionName] || [];
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
    hasLocalData: ['expenses', 'budgets', 'userCollections', 'userStages', 'stageNotes']
      .some((key) => userData[key].length > 0)
  };
}

function getCloudStatus() {
  const userId = getActiveUserId();
  const loginReady = Boolean(userId && wx.getStorageSync(AUTH_TOKEN_KEY));
  return {
    enabled: true,
    loginReady,
    databaseReady: loginReady,
    userId,
    message: loginReady
      ? '已连接云端，消费、预算、藏品和舞台数据以云端为准；本地仅保留缓存和草稿。'
      : '云端已启用，正在等待微信身份初始化。'
  };
}

module.exports = {
  initUserStorage, createDefaultUserData, setActiveUser, getActiveUserId,
  readUserData, writeUserData, resetUserData, getCollection, setCollection,
  getLocalDataSummary, getCloudStatus
};
