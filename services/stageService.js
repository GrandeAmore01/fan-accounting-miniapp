const stages = require('../data/stages');
const storageService = require('./storageService');

const USER_ID = 'local-user';

function listStages() {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  return stages.map((item) => {
    const userState = userStages.find((state) => state.stageId === item.stageId);
    return {
      ...item,
      songListText: (item.songList || []).join('、'),
      isLighted: Boolean(userState && userState.isLighted),
      lightTime: userState ? userState.lightTime : ''
    };
  });
}

function lightStage(stageId) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    exists.isLighted = !exists.isLighted;
    exists.lightTime = exists.isLighted ? new Date().toISOString() : '';
  } else {
    userStages.push({
      userId: USER_ID,
      stageId,
      isLighted: true,
      lightTime: new Date().toISOString()
    });
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
  return listStages();
}

function getStageStats() {
  const list = listStages();
  const lightedStages = list.filter((item) => item.isLighted);
  const songNames = new Set();
  lightedStages.forEach((stage) => {
    (stage.songList || []).forEach((song) => songNames.add(song));
  });
  return {
    total: list.length,
    lightedCount: lightedStages.length,
    unlockedSongCount: songNames.size
  };
}

module.exports = {
  listStages,
  lightStage,
  getStageStats
};
