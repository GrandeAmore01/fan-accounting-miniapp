const memoryStorage = new Map();

global.wx = {
  getStorageSync: jest.fn((key) =>
    memoryStorage.get(key)
  ),

  setStorageSync: jest.fn((key, value) => {
    memoryStorage.set(key, value);
  }),

  removeStorageSync: jest.fn((key) => {
    memoryStorage.delete(key);
  }),

  clearStorageSync: jest.fn(() => {
    memoryStorage.clear();
  }),

  login: jest.fn(),

  cloud: {
    callContainer: jest.fn()
  }
};
