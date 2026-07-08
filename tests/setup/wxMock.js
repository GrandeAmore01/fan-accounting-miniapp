const storage = new Map();

global.wx = {
  getStorageSync(key) {
    return storage.has(key) ? storage.get(key) : '';
  },

  setStorageSync(key, value) {
    storage.set(key, value);
  },

  removeStorageSync(key) {
    storage.delete(key);
  },

  clearStorageSync() {
    storage.clear();
  }
};

global.__wxStorage = storage;