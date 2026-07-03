const collections = require('../data/collections');
const categories = require('../data/categories');
const expenseService = require('./expenseService');
const storageService = require('./storageService');

const USER_ID = 'local-user';
const collectionCategories = categories.filter((item) => item.type === 'collection');

function getCategoryName(categoryId) {
  const category = collectionCategories.find((item) => item.id === categoryId);
  return category ? category.name : '其他藏品';
}

function getCollectionById(collectionId) {
  return collections.find((item) => item.collectionId === collectionId);
}

function listCollections() {
  const userCollections = storageService.getCollection(USER_ID, 'userCollections');
  return collections.map((item) => {
    const userState = userCollections.find((state) => state.collectionId === item.collectionId);
    return {
      ...item,
      categoryName: getCategoryName(item.category),
      isOwned: Boolean(userState && userState.isOwned),
      lightTime: userState ? userState.lightTime : '',
      expenseId: userState ? userState.expenseId : ''
    };
  });
}

function filterCollections(filter) {
  const keyword = (filter.keyword || '').trim();
  const category = filter.category || 'all';
  const ownedStatus = filter.ownedStatus || 'all';
  return listCollections().filter((item) => {
    const categoryMatched = category === 'all' || item.category === category;
    const keywordMatched =
      !keyword ||
      item.collectionName.indexOf(keyword) >= 0 ||
      (item.description || '').indexOf(keyword) >= 0;
    const statusMatched =
      ownedStatus === 'all' ||
      (ownedStatus === 'owned' && item.isOwned) ||
      (ownedStatus === 'missing' && !item.isOwned);
    return categoryMatched && keywordMatched && statusMatched;
  });
}

function setCollectionOwned(collectionId, isOwned) {
  const userCollections = storageService.getCollection(USER_ID, 'userCollections');
  const exists = userCollections.find((item) => item.collectionId === collectionId);
  if (exists) {
    exists.isOwned = isOwned;
    exists.lightTime = isOwned ? new Date().toISOString() : '';
  } else {
    userCollections.push({
      userId: USER_ID,
      collectionId,
      isOwned,
      lightTime: isOwned ? new Date().toISOString() : '',
      expenseId: ''
    });
  }
  storageService.setCollection(USER_ID, 'userCollections', userCollections);
  return {
    valid: true,
    data: listCollections().find((item) => item.collectionId === collectionId)
  };
}

function lightCollection(collectionId) {
  return setCollectionOwned(collectionId, true);
}

function unlightCollection(collectionId) {
  return setCollectionOwned(collectionId, false);
}

function createExpenseFromCollection(collectionId) {
  const collection = getCollectionById(collectionId);
  if (!collection) {
    return { valid: false, message: '图鉴项目不存在' };
  }
  const expenseResult = expenseService.addExpense({
    category: collection.category,
    itemName: collection.collectionName,
    amount: collection.referencePrice || 0,
    quantity: 1,
    date: getToday(),
    paymentMethod: '微信支付',
    remark: '由藏品图鉴点亮同步生成',
    includeInTotal: true,
    collectionId: collection.collectionId
  });
  if (!expenseResult.valid) {
    return expenseResult;
  }

  const userCollections = storageService.getCollection(USER_ID, 'userCollections');
  const exists = userCollections.find((item) => item.collectionId === collectionId);
  if (exists) {
    exists.expenseId = expenseResult.data.expenseId;
  }
  storageService.setCollection(USER_ID, 'userCollections', userCollections);
  return {
    valid: true,
    data: expenseResult.data
  };
}

function getCollectionProgress() {
  const list = listCollections();
  const ownedCount = list.filter((item) => item.isOwned).length;
  const percent = list.length > 0 ? Math.round((ownedCount / list.length) * 100) : 0;
  return {
    total: list.length,
    ownedCount,
    percent
  };
}

function getToday() {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

module.exports = {
  collectionCategories,
  listCollections,
  filterCollections,
  lightCollection,
  unlightCollection,
  createExpenseFromCollection,
  getCollectionProgress
};
