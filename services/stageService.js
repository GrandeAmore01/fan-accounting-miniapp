const localStages = require('../data/stages');
const storageService = require('./storageService');
const apiService = require('./apiService');
const config = require('./config');

const USER_ID = config.userId || 'local-user';
const MAX_PHOTOS = 9;

let stageCache = [];
let albumLibrary = [];
let stageLoadPromise = null;

function normalizeLocalStage(item) {
  const songList = item.songList || [];
  return {
    ...item,
    albumName: item.albumId || '未关联专辑',
    albumNameCn: item.albumId || '未关联专辑',
    songList,
    songs: songList.map((songName, index) => ({
      songId: `${item.stageId}_song_${index}`,
      songName,
      albumId: item.albumId || ''
    })),
    songCount: songList.length,
    songListText: songList.join('、'),
    songPreviewText: songList.slice(0, 3).join('、') + (songList.length > 3 ? '…' : ''),
    priceTierText: (item.priceTiers || []).map((price) => `${price}元`).join(' / '),
    cityName: item.city || item.location || '未填写城市',
    venueName: item.venue || item.stageName || '未填写场馆',
    isOnline: Boolean(item.isOnline),
    ticketPrice: Number(item.ticketPrice || 0),
    description: item.description || '',
    stageTypeName: item.stageType === 'festival' ? '音乐节/拼盘' : '演唱会'
  };
}

function buildAlbumLibraryFromStages(stages) {
  const albumMap = {};
  stages.forEach((stage) => {
    if (!stage.albumId) {
      return;
    }
    if (!albumMap[stage.albumId]) {
      albumMap[stage.albumId] = {
        albumId: stage.albumId,
        albumName: stage.albumNameCn || stage.albumId,
        albumNameCn: stage.albumNameCn || stage.albumId,
        songs: []
      };
    }
    (stage.songList || []).forEach((songName) => {
      if (!albumMap[stage.albumId].songs.find((song) => song.songName === songName)) {
        albumMap[stage.albumId].songs.push({
          songId: `${stage.albumId}_${songName}`,
          songName
        });
      }
    });
  });
  return Object.keys(albumMap).map((key) => ({
    ...albumMap[key],
    totalSongCount: albumMap[key].songs.length
  }));
}

async function loadStageData() {
  if (config.useStageBackend) {
    try {
      const data = await apiService.request({ url: '/stages' });
      stageCache = (data.stages || []).map((item) => ({ ...item }));
      albumLibrary = data.albums || buildAlbumLibraryFromStages(stageCache);
      pruneOrphanLocalData();
      return stageCache;
    } catch (error) {
      console.warn('舞台数据 API 加载失败，回退本地数据', error);
    }
  }
  stageCache = localStages.map(normalizeLocalStage);
  albumLibrary = buildAlbumLibraryFromStages(stageCache);
  pruneOrphanLocalData();
  return stageCache;
}

function pruneOrphanLocalData() {
  if (!stageCache.length) {
    return;
  }
  const validStageIds = new Set(stageCache.map((item) => item.stageId));
  const notes = getStageNotes();
  const prunedNotes = notes.filter((item) => validStageIds.has(item.stageId));
  if (prunedNotes.length !== notes.length) {
    saveStageNotes(prunedNotes);
  }
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const prunedUserStages = userStages.filter((item) => validStageIds.has(item.stageId));
  if (prunedUserStages.length !== userStages.length) {
    storageService.setCollection(USER_ID, 'userStages', prunedUserStages);
  }
}

function ensureStagesLoaded() {
  if (stageCache.length) {
    return Promise.resolve(stageCache);
  }
  if (!stageLoadPromise) {
    stageLoadPromise = loadStageData().finally(() => {
      stageLoadPromise = null;
    });
  }
  return stageLoadPromise;
}

function getStageNotes() {
  return storageService.getCollection(USER_ID, 'stageNotes');
}

function saveStageNotes(notes) {
  storageService.setCollection(USER_ID, 'stageNotes', notes);
}

function normalizeActualTicketPrice(value, options = {}) {
  const required = Boolean(options.required);
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) {
    if (required) {
      return { valid: false, message: '请输入票价' };
    }
    return { valid: true, value: 0 };
  }
  if (!/^\d+(\.\d+)?$/.test(text)) {
    return { valid: false, message: '票价必须为数字' };
  }
  const price = Number(text);
  if (!Number.isFinite(price) || price <= 0) {
    return { valid: false, message: '票价必须大于 0' };
  }
  return { valid: true, value: price };
}

function promptManualPrice(callbacks = {}) {
  wx.showModal({
    title: '输入票价',
    content: '',
    editable: true,
    placeholderText: '请输入大于 0 的数字，例如 680',
    success: (res) => {
      if (!res.confirm) {
        if (callbacks.onCancel) {
          callbacks.onCancel();
        }
        return;
      }
      const priceResult = normalizeActualTicketPrice(res.content, { required: true });
      if (!priceResult.valid) {
        wx.showToast({ title: priceResult.message, icon: 'none' });
        promptManualPrice(callbacks);
        return;
      }
      if (callbacks.onSelect) {
        callbacks.onSelect(priceResult.value);
      }
    }
  });
}

function getStageNote(stageId) {
  return getStageNotes().find((item) => item.stageId === stageId) || {
    stageId,
    seat: '',
    companions: '',
    note: '',
    actualTicketPrice: 0,
    photos: []
  };
}

function saveStageNote(stageId, payload = {}) {
  const priceResult = normalizeActualTicketPrice(payload.actualTicketPrice);
  if (!priceResult.valid) {
    return priceResult;
  }
  const notes = getStageNotes();
  const exists = notes.find((item) => item.stageId === stageId);
  const nextNote = {
    stageId,
    seat: payload.seat || '',
    companions: payload.companions || '',
    note: payload.note || '',
    actualTicketPrice: priceResult.value,
    photos: Array.isArray(payload.photos) ? payload.photos.slice(0, MAX_PHOTOS) : []
  };
  if (exists) {
    Object.assign(exists, nextNote);
  } else {
    notes.push(nextNote);
  }
  saveStageNotes(notes);
  return { valid: true, data: nextNote };
}

function addStagePhotos(stageId, photoPaths = []) {
  const note = getStageNote(stageId);
  const merged = [...(note.photos || []), ...photoPaths].slice(0, MAX_PHOTOS);
  return saveStageNote(stageId, { ...note, photos: merged });
}

function removeStagePhoto(stageId, photoPath) {
  const note = getStageNote(stageId);
  return saveStageNote(stageId, {
    ...note,
    photos: (note.photos || []).filter((item) => item !== photoPath)
  });
}

function getValidPriceTiers(stageOrTiers) {
  const tiers = Array.isArray(stageOrTiers) ? stageOrTiers : stageOrTiers.priceTiers || [];
  return Array.from(new Set(tiers.map((item) => Number(item)).filter((item) => item > 0))).sort(
    (a, b) => a - b
  );
}

function formatPriceTierText(priceTiers) {
  const validTiers = getValidPriceTiers(priceTiers);
  return validTiers.length > 0 ? validTiers.map((price) => `${price}元`).join(' / ') : '暂无';
}

function getStageAlbumNames(stage) {
  const albumIds = new Set();
  (stage.songs || []).forEach((song) => {
    if (song.albumId) {
      albumIds.add(song.albumId);
    }
  });
  if (stage.albumId) {
    albumIds.add(stage.albumId);
  }
  const names = albumLibrary
    .filter((album) => albumIds.has(album.albumId))
    .map((album) => album.albumNameCn || album.albumName)
    .filter(Boolean);
  if (names.length) {
    return Array.from(new Set(names));
  }
  if (stage.albumNameCn && stage.albumNameCn !== '未关联专辑') {
    return [stage.albumNameCn];
  }
  if (stage.albumName && stage.albumName !== '未关联专辑') {
    return [stage.albumName];
  }
  return [];
}

const MAX_ACTION_SHEET_ITEMS = 6;
const MORE_PRICE_TIER_LABEL = '更多票档…';

function showPriceTierActionSheet(tiers, callbacks = {}, offset = 0) {
  const rest = tiers.slice(offset);
  let selectableTiers;
  let itemList;
  if (rest.length <= MAX_ACTION_SHEET_ITEMS) {
    selectableTiers = rest;
    itemList = rest.map((price) => `${price} 元`);
  } else {
    selectableTiers = rest.slice(0, MAX_ACTION_SHEET_ITEMS - 1);
    itemList = [...selectableTiers.map((price) => `${price} 元`), MORE_PRICE_TIER_LABEL];
  }
  wx.showActionSheet({
    itemList,
    success: (res) => {
      if (rest.length > MAX_ACTION_SHEET_ITEMS && res.tapIndex === itemList.length - 1) {
        showPriceTierActionSheet(tiers, callbacks, offset + MAX_ACTION_SHEET_ITEMS - 1);
        return;
      }
      if (callbacks.onSelect) {
        callbacks.onSelect(selectableTiers[res.tapIndex]);
      }
    },
    fail: () => {
      if (callbacks.onCancel) {
        callbacks.onCancel();
      }
    }
  });
}

function resolveStageForPrompt(stageOrId) {
  const stageId = typeof stageOrId === 'string' ? stageOrId : stageOrId && stageOrId.stageId;
  if (!stageId) {
    return stageOrId;
  }
  return listStages().find((item) => item.stageId === stageId) || stageOrId;
}

function promptPriceTier(stage, callbacks = {}, options = {}) {
  const resolvedStage = resolveStageForPrompt(stage);
  const tiers = getValidPriceTiers(resolvedStage);
  const run = () => {
    if (tiers.length > 0) {
      showPriceTierActionSheet(tiers, callbacks);
      return;
    }
    promptManualPrice(callbacks);
  };
  const delayMs = Number(options.delayMs || 0);
  if (delayMs > 0) {
    setTimeout(run, delayMs);
    return;
  }
  run();
}

function getAllAlbumNames() {
  return albumLibrary.map((album) => album.albumNameCn || album.albumName).filter(Boolean);
}

function getYearOptions() {
  const years = Array.from(new Set(stageCache.map((item) => item.year))).sort((a, b) => b - a);
  return [{ id: 'all', name: '全部年份' }, ...years.map((year) => ({ id: String(year), name: `${year}年` }))];
}

function getStatsYearOptions() {
  const years = Array.from(new Set(stageCache.map((item) => item.year))).sort((a, b) => b - a);
  if (!years.length) {
    return [{ id: String(new Date().getFullYear()), name: `${new Date().getFullYear()}年` }];
  }
  return years.map((year) => ({ id: String(year), name: `${year}年` }));
}

function enrichStage(item) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const userState = userStages.find((state) => state.stageId === item.stageId);
  const note = getStageNote(item.stageId);
  const photos = note.photos || [];
  const albumNames = getStageAlbumNames(item);
  const validPriceTiers = getValidPriceTiers(item);
  return {
    ...item,
    albumNames,
    albumNamesText: albumNames.length > 0 ? albumNames.join('、') : '未关联专辑',
    priceTiers: validPriceTiers.length > 0 ? validPriceTiers : item.priceTiers || [],
    priceTierText: formatPriceTierText(item.priceTiers),
    ticketPrice: validPriceTiers[0] || Number(item.ticketPrice || 0),
    isLighted: Boolean(userState && userState.isLighted),
    lightTime: userState ? userState.lightTime : '',
    expenseId: userState ? userState.expenseId : '',
    photoCount: photos.length,
    photoCountText: photos.length > 0 ? `回忆照片：${photos.length} 张` : '',
    songPreviewText: item.songPreviewText || (item.songList || []).slice(0, 3).join('、')
  };
}

function listStages() {
  return stageCache.map(enrichStage);
}

function filterStages(filter) {
  const keyword = (filter.keyword || '').trim();
  const year = filter.year || 'all';
  const lightStatus = filter.lightStatus || 'all';
  const stageType = filter.stageType || 'all';
  return listStages().filter((item) => {
    const typeMatched = stageType === 'all' || item.stageType === stageType;
    const yearMatched = year === 'all' || String(item.year) === year;
    const keywordMatched =
      !keyword ||
      item.stageName.indexOf(keyword) >= 0 ||
      item.location.indexOf(keyword) >= 0 ||
      item.city.indexOf(keyword) >= 0 ||
      item.songListText.indexOf(keyword) >= 0;
    const statusMatched =
      lightStatus === 'all' ||
      (lightStatus === 'lighted' && item.isLighted) ||
      (lightStatus === 'unlighted' && !item.isLighted);
    return typeMatched && yearMatched && keywordMatched && statusMatched;
  });
}

function searchSongs(keyword) {
  const text = (keyword || '').trim();
  if (!text) {
    return [];
  }
  const songMap = {};
  listStages().forEach((stage) => {
    (stage.songList || []).forEach((songName) => {
      if (songName.indexOf(text) < 0) {
        return;
      }
      if (!songMap[songName]) {
        songMap[songName] = {
          songName,
          stages: []
        };
      }
      songMap[songName].stages.push(stage);
    });
  });
  return Object.keys(songMap)
    .map((key) => songMap[key])
    .sort((a, b) => a.songName.localeCompare(b.songName, 'zh-CN'));
}

function getStagesByType(stageType) {
  return listStages().filter((item) => item.stageType === stageType);
}

function getConcertStageOptions() {
  return getStagesByType('concert').map((item) => ({
    id: item.stageId,
    name: `${item.date} ${item.stageName}`,
    date: item.date,
    stageName: item.stageName,
    priceTiers: item.priceTiers || []
  }));
}

function findStageByDate(date, stageType = 'concert') {
  return listStages().find((item) => item.stageType === stageType && item.date === date);
}

function parseDateValue(dateText) {
  if (!dateText) {
    return null;
  }
  const [year, month, day] = dateText.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(dateText) {
  return dateText ? dateText.replace(/-/g, '.') : '暂无记录';
}

function diffDays(fromDate, toDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((toDate.getTime() - fromDate.getTime()) / oneDay);
}

function buildMeetItem(stage, days) {
  if (!stage) {
    return {
      daysText: '--',
      dateText: '暂无记录',
      stageName: ''
    };
  }
  return {
    daysText: String(days),
    dateText: formatDisplayDate(stage.date),
    stageName: stage.stageName
  };
}

function getMeetTimeline() {
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const meetStages = listStages()
    .filter((item) => item.stageType === 'concert' || item.stageType === 'festival')
    .filter((item) => item.isLighted)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());

  const pastStages = meetStages.filter((item) => parseDateValue(item.date).getTime() <= todayDate.getTime());
  const futureStages = meetStages.filter((item) => parseDateValue(item.date).getTime() > todayDate.getTime());
  const lastMeet = pastStages[pastStages.length - 1];
  const nextMeet = futureStages[0];
  const firstMeet = meetStages[0];

  return {
    hasMeetStages: meetStages.length > 0,
    lastMeet: buildMeetItem(lastMeet, lastMeet ? diffDays(parseDateValue(lastMeet.date), todayDate) : 0),
    nextMeet: buildMeetItem(nextMeet, nextMeet ? diffDays(todayDate, parseDateValue(nextMeet.date)) : 0),
    firstMeetDateText: firstMeet ? formatDisplayDate(firstMeet.date) : '暂无记录'
  };
}

function sortRankItems(items) {
  return items.sort((a, b) => b.count - a.count || b.latestDate.localeCompare(a.latestDate));
}

function buildRankMap(stagesList, fieldName) {
  const rankMap = {};
  stagesList.forEach((stage) => {
    const name = stage[fieldName] || '未填写';
    if (!rankMap[name]) {
      rankMap[name] = {
        name,
        count: 0,
        latestDate: '',
        earliestDate: ''
      };
    }
    rankMap[name].count += 1;
    if (!rankMap[name].latestDate || stage.date > rankMap[name].latestDate) {
      rankMap[name].latestDate = stage.date;
    }
    if (!rankMap[name].earliestDate || stage.date < rankMap[name].earliestDate) {
      rankMap[name].earliestDate = stage.date;
    }
  });
  return sortRankItems(Object.keys(rankMap).map((key) => rankMap[key])).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

function getLightedStages(stageType) {
  return listStages()
    .filter((item) => item.isLighted)
    .filter((item) => !stageType || item.stageType === stageType);
}

function getSongStats(stageList) {
  const songMap = {};
  (stageList || getLightedStages()).forEach((stage) => {
    (stage.songList || []).forEach((song) => {
      if (!songMap[song]) {
        songMap[song] = {
          songName: song,
          count: 0
        };
      }
      songMap[song].count += 1;
    });
  });
  return Object.keys(songMap)
    .map((key) => songMap[key])
    .sort((a, b) => b.count - a.count || a.songName.localeCompare(b.songName, 'zh-CN'));
}

function getAlbumSongProgress() {
  const lightedStages = getLightedStages();
  const unlockedSongMap = {};
  lightedStages.forEach((stage) => {
    (stage.songList || []).forEach((song) => {
      unlockedSongMap[song] = true;
    });
  });
  return albumLibrary
    .filter((album) => album.totalSongCount > 0)
    .map((album) => {
      const unlockedCount = album.songs.filter((song) => unlockedSongMap[song.songName]).length;
      const total = album.totalSongCount || album.songs.length;
      return {
        albumId: album.albumId,
        albumName: album.albumNameCn || album.albumName || album.albumId,
        unlockedCount,
        total,
        percent: total > 0 ? Math.round((unlockedCount / total) * 100) : 0
      };
    });
}

function getYearStats(year, stageType = 'all') {
  const targetYear = String(year || new Date().getFullYear());
  const lightedStages = getLightedStages(stageType === 'all' ? '' : stageType)
    .filter((item) => String(item.year) === targetYear)
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());
  const songStats = getSongStats(lightedStages);
  const citySet = new Set(lightedStages.map((item) => item.cityName || item.city));
  const songAppearCount = lightedStages.reduce((sum, stage) => sum + (stage.songCount || 0), 0);
  return {
    year: targetYear,
    hasRecords: lightedStages.length > 0,
    lightedCount: lightedStages.length,
    unlockedSongCount: songStats.length,
    cityCount: citySet.size,
    songAppearCount,
    topSongs: songStats.slice(0, 5),
    stages: lightedStages
  };
}

function getStageStats() {
  const list = listStages();
  const lightedStages = list.filter((item) => item.isLighted);
  const songStats = getSongStats();
  const progressPercent = list.length > 0 ? Math.round((lightedStages.length / list.length) * 100) : 0;
  return {
    total: list.length,
    lightedCount: lightedStages.length,
    unlockedSongCount: songStats.length,
    progressPercent
  };
}

function getLinkedExpense(stage) {
  const expenseService = require('./expenseService');
  const expenses = expenseService.listExpenses();
  if (stage.expenseId) {
    const linked = expenses.find((item) => item.expenseId === stage.expenseId);
    if (linked) {
      return linked;
    }
  }
  return expenses.find((item) => item.stageId === stage.stageId) || null;
}

function hasStageLinkedExpense(stageOrId) {
  const stageId = typeof stageOrId === 'string' ? stageOrId : stageOrId && stageOrId.stageId;
  if (!stageId) {
    return false;
  }
  const stage = listStages().find((item) => item.stageId === stageId);
  return Boolean(stage && getLinkedExpense(stage));
}

function linkStageExpense(stageId, expenseId) {
  if (!stageId || !expenseId) {
    return;
  }
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    exists.isLighted = true;
    exists.expenseId = expenseId;
    if (!exists.lightTime) {
      exists.lightTime = new Date().toISOString();
    }
  } else {
    userStages.push({
      userId: USER_ID,
      stageId,
      isLighted: true,
      lightTime: new Date().toISOString(),
      expenseId
    });
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
}

function clearStageExpenseLink(stageId, expenseId) {
  if (!stageId) {
    return;
  }
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (!exists) {
    return;
  }
  if (!expenseId || exists.expenseId === expenseId) {
    exists.expenseId = '';
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
}

function confirmUnlightStage(stageId, callbacks = {}) {
  const hasLinkedExpense = hasStageLinkedExpense(stageId);
  wx.showModal({
    title: '取消点亮',
    content: hasLinkedExpense
      ? '取消点亮后，是否同时删除这条舞台同步生成的消费记录？'
      : '取消后会同步更新歌曲统计和专辑进度，确定要取消吗？',
    cancelText: hasLinkedExpense ? '保留记录' : '再想想',
    confirmText: hasLinkedExpense ? '删除记录' : '取消点亮',
    confirmColor: '#c84d69',
    success: (res) => {
      if (!res.confirm && !hasLinkedExpense) {
        return;
      }
      unlightStage(stageId, { deleteExpense: hasLinkedExpense && res.confirm });
      const deletedExpense = hasLinkedExpense && res.confirm;
      wx.showToast({
        title: deletedExpense ? '已删除记录' : '已取消点亮',
        icon: 'success'
      });
      if (callbacks.onDone) {
        callbacks.onDone({ deletedExpense });
      }
    }
  });
}

function getStageDetail(stageId) {
  const stage = listStages().find((item) => item.stageId === stageId);
  if (!stage) {
    return null;
  }
  const note = getStageNote(stageId);
  const expense = getLinkedExpense(stage);
  const displaySeat = note.seat || (expense ? expense.seat : '');
  return {
    ...stage,
    note,
    expense,
    displaySeat,
    expenseSummary: expense
      ? {
          itemName: expense.itemName,
          date: expense.date,
          totalAmount: expense.totalAmount,
          includedAmount: expense.includedAmount,
          seat: expense.seat || ''
        }
      : null
  };
}

function getMeetMemoryReport(stageType = 'concert') {
  const typeName = stageType === 'festival' ? '音乐节/拼盘' : '演唱会';
  const lightedMeetStages = getLightedStages(stageType)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());
  const cityRanking = buildRankMap(lightedMeetStages, 'cityName');
  const venueRanking = buildRankMap(lightedMeetStages, 'venueName');
  const firstStage = lightedMeetStages[0];
  const latestStage = lightedMeetStages[lightedMeetStages.length - 1];
  const topCity = cityRanking[0] || { name: '暂无记录', count: 0 };
  const topVenue = venueRanking[0] || { name: '暂无记录', count: 0 };

  return {
    stageType,
    typeName,
    hasRecords: lightedMeetStages.length > 0,
    meetCount: lightedMeetStages.length,
    cityCount: cityRanking.length,
    venueCount: venueRanking.length,
    topCity,
    topVenue,
    firstVenueName: firstStage ? firstStage.venueName : '暂无记录',
    firstCityName: firstStage ? firstStage.cityName : '暂无记录',
    earliestDateText: firstStage ? formatDisplayDate(firstStage.date) : '暂无记录',
    latestDateText: latestStage ? formatDisplayDate(latestStage.date) : '暂无记录',
    cityRanking,
    venueRanking
  };
}

function getAnnualMemoryReport(year, stageType = 'all') {
  const targetYear = String(year || new Date().getFullYear());
  const expenseService = require('./expenseService');
  const lightedStages = getLightedStages()
    .filter((item) => stageType === 'all' || item.stageType === stageType)
    .filter((item) => String(item.year) === targetYear);
  const songStats = getSongStats(lightedStages);
  const cityRanking = buildRankMap(lightedStages, 'cityName');
  const expenses = expenseService.listExpenses().filter((item) => {
    if (!item.stageId) {
      return false;
    }
    const stage = listStages().find((stageItem) => stageItem.stageId === item.stageId);
    return stage && String(stage.year) === targetYear;
  });
  const stageSpending = expenses.reduce((sum, item) => sum + Number(item.includedAmount || item.totalAmount || 0), 0);
  const songAppearCount = lightedStages.reduce((sum, stage) => sum + (stage.songCount || 0), 0);
  return {
    year: targetYear,
    hasRecords: lightedStages.length > 0,
    meetCount: lightedStages.length,
    unlockedSongCount: songStats.length,
    cityCount: cityRanking.length,
    stageSpending: stageSpending.toFixed(2),
    songAppearCount,
    expenseCount: expenses.length,
    topCity: cityRanking[0] || { name: '暂无记录', count: 0 },
    topSongs: songStats.slice(0, 5),
    cityRanking
  };
}

function getMeetCalendar(year, stageType = 'concert') {
  const targetYear = String(year || new Date().getFullYear());
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lightedStages = getLightedStages(stageType === 'all' ? '' : stageType)
    .filter((item) => String(item.year) === targetYear)
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());
  const monthMap = {};
  lightedStages.forEach((stage) => {
    const month = Number(stage.date.split('-')[1]);
    if (!monthMap[month]) {
      monthMap[month] = {
        month,
        monthLabel: `${month}月`,
        watchedCount: 0,
        upcomingCount: 0,
        items: []
      };
    }
    const isUpcoming = parseDateValue(stage.date).getTime() > todayDate.getTime();
    if (isUpcoming) {
      monthMap[month].upcomingCount += 1;
    } else {
      monthMap[month].watchedCount += 1;
    }
    monthMap[month].items.push({
      ...stage,
      calendarStatus: isUpcoming ? 'upcoming' : 'watched',
      calendarStatusText: isUpcoming ? '待看' : '看过'
    });
  });
  return Object.keys(monthMap)
    .map((key) => monthMap[key])
    .sort((a, b) => a.month - b.month);
}

function getSongCollectionStats() {
  const lightedStages = getLightedStages();
  const heardMap = {};
  lightedStages.forEach((stage) => {
    (stage.songList || []).forEach((songName) => {
      if (!heardMap[songName]) {
        heardMap[songName] = 0;
      }
      heardMap[songName] += 1;
    });
  });
  const libraryMap = {};
  stageCache.forEach((stage) => {
    (stage.songList || []).forEach((songName) => {
      if (!libraryMap[songName]) {
        libraryMap[songName] = 0;
      }
      libraryMap[songName] += 1;
    });
  });
  const heardSongs = Object.keys(heardMap)
    .map((songName) => ({ songName, count: heardMap[songName] }))
    .sort((a, b) => b.count - a.count || a.songName.localeCompare(b.songName, 'zh-CN'));
  const unheardSongs = Object.keys(libraryMap)
    .filter((songName) => !heardMap[songName])
    .map((songName) => ({ songName, stageCount: libraryMap[songName] }))
    .sort((a, b) => b.stageCount - a.stageCount || a.songName.localeCompare(b.songName, 'zh-CN'));
  const libraryCount = Object.keys(libraryMap).length;
  const heardCount = heardSongs.length;
  return {
    heardCount,
    libraryCount,
    isComplete: libraryCount > 0 && heardCount >= libraryCount,
    topHeardSongs: heardSongs.slice(0, 8),
    unheardSongs: unheardSongs.slice(0, 12)
  };
}

function getPhotoWall() {
  const validStageIds = new Set(stageCache.map((item) => item.stageId));
  const groups = getStageNotes()
    .filter((item) => validStageIds.has(item.stageId))
    .filter((item) => (item.photos || []).length > 0)
    .map((note) => {
      const stage = listStages().find((item) => item.stageId === note.stageId);
      if (!stage) {
        return null;
      }
      return {
        stageId: note.stageId,
        stageName: stage.stageName,
        date: stage.date,
        city: stage.cityName,
        photos: note.photos || []
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return {
    hasPhotos: groups.length > 0,
    groups
  };
}

function splitCompanions(text) {
  return (text || '')
    .split(/[,，、;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCompanionProfiles() {
  const notes = getStageNotes();
  const profileMap = {};
  notes.forEach((note) => {
    const stage = listStages().find((item) => item.stageId === note.stageId);
    if (!stage || !stage.isLighted) {
      return;
    }
    splitCompanions(note.companions).forEach((name) => {
      if (!profileMap[name]) {
        profileMap[name] = {
          name,
          count: 0,
          latestDate: '',
          stages: []
        };
      }
      profileMap[name].count += 1;
      if (!profileMap[name].latestDate || stage.date > profileMap[name].latestDate) {
        profileMap[name].latestDate = stage.date;
      }
      profileMap[name].stages.push({
        stageId: stage.stageId,
        stageName: stage.stageName,
        date: stage.date,
        city: stage.cityName
      });
    });
  });
  return sortRankItems(
    Object.keys(profileMap).map((key) => ({
      ...profileMap[key],
      stages: profileMap[key].stages.sort((a, b) => b.date.localeCompare(a.date))
    }))
  );
}

function setStageLighted(stageId, isLighted, options = {}) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    if (!isLighted && options.deleteExpense) {
      const expenseService = require('./expenseService');
      const stage = listStages().find((item) => item.stageId === stageId);
      const linked = stage ? getLinkedExpense(stage) : null;
      if (linked) {
        expenseService.removeExpense(linked.expenseId);
      }
      exists.expenseId = '';
    }
    exists.isLighted = isLighted;
    exists.lightTime = isLighted ? new Date().toISOString() : '';
  } else {
    userStages.push({
      userId: USER_ID,
      stageId,
      isLighted,
      lightTime: isLighted ? new Date().toISOString() : '',
      expenseId: ''
    });
  }
  storageService.setCollection(USER_ID, 'userStages', userStages);
  return {
    valid: true,
    data: listStages().find((item) => item.stageId === stageId)
  };
}

function lightStage(stageId) {
  return setStageLighted(stageId, true);
}

function unlightStage(stageId, options = {}) {
  return setStageLighted(stageId, false, options);
}

function getStageById(stageId) {
  return stageCache.find((item) => item.stageId === stageId);
}

function createExpenseFromStage(stageId, priceTier) {
  const expenseService = require('./expenseService');
  const stage = getStageById(stageId);
  if (!stage) {
    return { valid: false, message: '舞台场次不存在' };
  }
  const price = Number(priceTier || 0);
  if (price <= 0) {
    return { valid: false, message: '请先选择票档或输入有效票价' };
  }
  const expenseResult = expenseService.addExpense({
    category: 'meet',
    subType: stage.stageType === 'festival' ? 'festival' : 'concert',
    itemName: stage.stageName,
    amount: price,
    quantity: 1,
    date: stage.date,
    paymentMethod: '微信支付',
    location: stage.location || '',
    remark: '由舞台记录点亮同步生成',
    includeInTotal: true,
    stageId: stage.stageId,
    stageDate: stage.date,
    priceTier: price
  });
  if (!expenseResult.valid) {
    return expenseResult;
  }

  linkStageExpense(stageId, expenseResult.data.expenseId);
  return {
    valid: true,
    data: expenseResult.data
  };
}

function getStageDashboard(filter = {}) {
  const keyword = (filter.keyword || '').trim();
  const songSearchResults = keyword ? searchSongs(keyword) : [];
  return {
    meetTimeline: getMeetTimeline(),
    stages: filterStages(filter),
    stats: getStageStats(),
    songStats: getSongStats(),
    albumProgress: getAlbumSongProgress(),
    songSearchResults,
    yearStats: getYearStats(filter.statsYear, filter.stageType || 'all'),
    statsYearOptions: getStatsYearOptions()
  };
}

module.exports = {
  ensureStagesLoaded,
  getYearOptions,
  getStatsYearOptions,
  listStages,
  filterStages,
  searchSongs,
  getStagesByType,
  getConcertStageOptions,
  findStageByDate,
  lightStage,
  unlightStage,
  createExpenseFromStage,
  getMeetTimeline,
  getMeetMemoryReport,
  getAnnualMemoryReport,
  getMeetCalendar,
  getSongCollectionStats,
  getPhotoWall,
  getCompanionProfiles,
  getSongStats,
  getAlbumSongProgress,
  getYearStats,
  getStageStats,
  getStageDashboard,
  getStageDetail,
  getStageNote,
  saveStageNote,
  addStagePhotos,
  removeStagePhoto,
  getValidPriceTiers,
  promptPriceTier,
  getAllAlbumNames,
  getStageAlbumNames,
  hasStageLinkedExpense,
  getLinkedExpense,
  linkStageExpense,
  clearStageExpenseLink,
  confirmUnlightStage,
  MAX_PHOTOS
};
