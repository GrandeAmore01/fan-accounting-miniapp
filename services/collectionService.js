const collections = require('../data/collections');
const storageService = require('./storageService');

const USER_ID = 'local-user';

function listCollections() {
  const userCollections = storageService.getCollection(USER_ID, 'userCollections');
  return collections.map((item) => {
    const userState = userCollections.find((state) => state.collectionId === item.collectionId);
    return {
      ...item,
      isOwned: Boolean(userState && userState.isOwned),
      lightTime: userState ? userState.lightTime : ''
    };
  });
}

function lightCollection(collectionId) {
  const userCollections = storageService.getCollection(USER_ID, 'userCollections');
  const exists = userCollections.find((item) => item.collectionId === collectionId);
  if (exists) {
    exists.isOwned = !exists.isOwned;
    exists.lightTime = exists.isOwned ? new Date().toISOString() : '';
  } else {
    userCollections.push({
      userId: USER_ID,
      collectionId,
      isOwned: true,
      lightTime: new Date().toISOString(),
      expenseId: ''
    });
  }
  storageService.setCollection(USER_ID, 'userCollections', userCollections);
  return listCollections();
}

function getCollectionProgress() {
  const list = listCollections();
  const ownedCount = list.filter((item) => item.isOwned).length;
  return {
    total: list.length,
    ownedCount
  };
}

module.exports = {
  listCollections,
  lightCollection,
  getCollectionProgress
};
