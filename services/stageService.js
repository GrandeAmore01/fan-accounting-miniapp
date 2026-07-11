const localStages = require('../data/stages');
const storageService = require('./storageService');
const apiService = require('./apiService');
const config = require('./config');

const USER_ID = config.userId || 'local-user';
const STAGE_API_BASE_URL = config.stageApiBaseUrl || config.apiBaseUrl;
const COUNTDOWN_PLACEHOLDER_STAGE_ID = 'stage_countdown_placeholder';

const COUNTDOWN_PLACEHOLDER_STAGE = {
  stageId: COUNTDOWN_PLACEHOLDER_STAGE_ID,
  stageName: '下一见面（待定场次）',
  stageType: 'concert',
  year: 2026,
  date: '2026-12-31',
  city: '待定',
  venue: '待定场馆',
  location: '待定',
  albumId: '',
  albumName: '未关联专辑',
  albumNameCn: '未关联专辑',
  songList: [],
  songs: [],
  songCount: 0,
  songListText: '',
  songPreviewText: '',
  priceTiers: [],
  priceTierText: '待定',
  cityName: '待定',
  venueName: '待定场馆',
  isOnline: false,
  ticketPrice: 0,
  description: '用于展示距离下次见面的倒计时',
  stageTypeName: '演唱会',
  isCountdownPlaceholder: true
};

function getStageMeetCategory(stage) {
  const name = `${(stage && stage.stageName) || ''}${(stage && stage.description) || ''}`;
  if (name.indexOf('新年音乐会') >= 0 || name.indexOf('运动会') >= 0) {
    return 'special';
  }
  return 'concert';
}

function getMeetCategoryName(category) {
  return category === 'special' ? '运动会/新年音乐会' : '演唱会';
}

function getStageTypeName(stage) {
  const name = `${(stage && stage.stageName) || ''}${(stage && stage.description) || ''}`;
  if (name.indexOf('新年音乐会') >= 0) {
    return '新年音乐会';
  }
  if (name.indexOf('运动会') >= 0) {
    return '运动会';
  }
  if (stage && stage.stageType === 'festival') {
    return '音乐节/拼盘';
  }
  return '演唱会';
}

function inferExpenseSubType(stage) {
  const name = `${(stage && stage.stageName) || ''}${(stage && stage.description) || ''}`;
  if (name.indexOf('新年音乐会') >= 0) {
    return 'new_year_concert';
  }
  if (name.indexOf('运动会') >= 0) {
    return 'sports_day';
  }
  return 'concert';
}

function matchesMeetCategory(stage, category) {
  if (!category || category === 'all') {
    return true;
  }
  return getStageMeetCategory(stage) === category;
}

let stageCache = [];
let albumLibrary = [];
let stageLoadPromise = null;
let userStateByStageId = {};
let noteByStageId = {};
let expenseListCache = null;

function requestStageApi(options) {
  return apiService.request({
    ...options,
    baseUrl: STAGE_API_BASE_URL
  });
}

function getUserStageState(stageId) {
  return userStateByStageId[stageId] || null;
}

function getUserStageNotesList() {
  return Object.keys(noteByStageId).map((stageId) => noteByStageId[stageId]);
}

function setUserStageState(stageId, state = {}) {
  userStateByStageId[stageId] = {
    stageId,
    isLighted: Boolean(state.isLighted),
    lightTime: state.lightTime || '',
    expenseId: state.expenseId || '',
    actualTicketPrice: Number(state.actualTicketPrice || 0)
  };
}

function setStageNoteState(stageId, note = {}) {
  noteByStageId[stageId] = {
    stageId,
    seat: note.seat || '',
    companions: note.companions || '',
    note: note.note || '',
    actualTicketPrice: Number(note.actualTicketPrice || 0)
  };
}

function hydrateUserStateFromLocal() {
  userStateByStageId = {};
  noteByStageId = {};
  storageService.getCollection(USER_ID, 'userStages').forEach((item) => {
    setUserStageState(item.stageId, item);
  });
  storageService.getCollection(USER_ID, 'stageNotes').forEach((item) => {
    setStageNoteState(item.stageId, item);
  });
}

async function loadUserStateFromCloud() {
  if (!config.useStageBackend) {
    hydrateUserStateFromLocal();
    return;
  }
  try {
    const [userStages, stageNotes] = await Promise.all([
      requestStageApi({
        url: `/user-stages${apiService.buildQuery({ userId: USER_ID })}`
      }),
      requestStageApi({
        url: `/stage-notes${apiService.buildQuery({ userId: USER_ID })}`
      })
    ]);
    userStateByStageId = {};
    noteByStageId = {};
    (userStages || []).forEach((item) => {
      setUserStageState(item.stageId, item);
    });
    (stageNotes || []).forEach((item) => {
      const userState = getUserStageState(item.stageId);
      setStageNoteState(item.stageId, {
        ...item,
        actualTicketPrice: userState ? userState.actualTicketPrice : 0
      });
    });
    storageService.setCollection(USER_ID, 'userStages', userStages || []);
    storageService.setCollection(USER_ID, 'stageNotes', stageNotes || []);
  } catch (error) {
    console.warn('舞台用户状态 API 加载失败', error);
    userStateByStageId = {};
    noteByStageId = {};
  }
}

async function loadExpenseCache() {
  const expenseService = require('./expenseService');
  if (!config.useBackend) {
    expenseListCache = expenseService.listExpenses();
    return;
  }
  try {
    expenseListCache = await expenseService.listExpensesAsync();
  } catch (error) {
    console.warn('消费记录加载失败，回退本地数据', error);
    expenseListCache = expenseService.listExpenses();
  }
}

function getExpenseList() {
  if (expenseListCache) {
    return expenseListCache;
  }
  const expenseService = require('./expenseService');
  return expenseService.listExpenses();
}

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
    stageTypeName: getStageTypeName(item)
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
      const data = await requestStageApi({ url: '/stages' });
      stageCache = (data.stages || []).map((item) => ({ ...item }));
      albumLibrary = data.albums || buildAlbumLibraryFromStages(stageCache);
      injectCountdownPlaceholderStage();
      pruneOrphanLocalData();
      return stageCache;
    } catch (error) {
      console.warn('舞台数据 API 加载失败，回退本地数据', error);
    }
  }
  stageCache = localStages.map(normalizeLocalStage);
  albumLibrary = buildAlbumLibraryFromStages(stageCache);
  injectCountdownPlaceholderStage();
  pruneOrphanLocalData();
  return stageCache;
}

function injectCountdownPlaceholderStage() {
  if (stageCache.some((item) => item.stageId === COUNTDOWN_PLACEHOLDER_STAGE_ID)) {
    return;
  }
  stageCache.push({ ...COUNTDOWN_PLACEHOLDER_STAGE });
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
  if (!stageLoadPromise) {
    stageLoadPromise = (async () => {
      if (!stageCache.length) {
        await loadStageData();
      }
      await loadUserStateFromCloud();
      await loadExpenseCache();
      return stageCache;
    })().finally(() => {
      stageLoadPromise = null;
    });
  }
  return stageLoadPromise;
}

function getStageNotes() {
  if (config.useStageBackend) {
    return getUserStageNotesList();
  }
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

function persistUserStageStateLocal(stageId, isLighted, options = {}) {
  const userStages = storageService.getCollection(USER_ID, 'userStages');
  const exists = userStages.find((item) => item.stageId === stageId);
  if (exists) {
    exists.isLighted = isLighted;
    exists.lightTime = isLighted ? exists.lightTime || new Date().toISOString() : '';
    if (!isLighted) {
      exists.expenseId = '';
    }
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
  const previous = exists || {};
  setUserStageState(stageId, {
    stageId,
    isLighted,
    lightTime: isLighted ? previous.lightTime || new Date().toISOString() : '',
    expenseId: isLighted ? previous.expenseId || '' : '',
    actualTicketPrice: isLighted ? Number(previous.actualTicketPrice || 0) : 0
  });
}

function persistStageNoteLocal(stageId, nextNote) {
  const notes = storageService.getCollection(USER_ID, 'stageNotes');
  const exists = notes.find((item) => item.stageId === stageId);
  if (exists) {
    Object.assign(exists, nextNote);
  } else {
    notes.push(nextNote);
  }
  saveStageNotes(notes);
  setStageNoteState(stageId, nextNote);
}

async function clearStageNote(stageId) {
  delete noteByStageId[stageId];
  const notes = storageService.getCollection(USER_ID, 'stageNotes');
  const filtered = notes.filter((item) => item.stageId !== stageId);
  if (filtered.length !== notes.length) {
    saveStageNotes(filtered);
  }
  if (!config.useStageBackend) {
    return;
  }
  try {
    await requestStageApi({
      url: `/stage-notes/${stageId}`,
      method: 'PUT',
      data: {
        userId: USER_ID,
        seat: '',
        companions: '',
        note: '',
        actualTicketPrice: 0,
        photos: []
      }
    });
  } catch (error) {
    console.warn('清空观演备注失败', error);
  }
}

function getStageNote(stageId) {
  const note = noteByStageId[stageId] || getStageNotes().find((item) => item.stageId === stageId);
  const userState = getUserStageState(stageId);
  if (note) {
    return {
      ...note,
      actualTicketPrice: Number(
        (userState && userState.actualTicketPrice) || note.actualTicketPrice || 0
      )
    };
  }
  return {
    stageId,
    seat: '',
    companions: '',
    note: '',
    actualTicketPrice: userState ? Number(userState.actualTicketPrice || 0) : 0
  };
}

async function saveStageNote(stageId, payload = {}) {
  const priceResult = normalizeActualTicketPrice(payload.actualTicketPrice);
  if (!priceResult.valid) {
    return priceResult;
  }
  const nextNote = {
    stageId,
    seat: payload.seat || '',
    companions: payload.companions || '',
    note: payload.note || '',
    actualTicketPrice: priceResult.value,
    photos: []
  };

  if (config.useStageBackend) {
    try {
      await requestStageApi({
        url: `/stage-notes/${stageId}`,
        method: 'PUT',
        data: {
          userId: USER_ID,
          ...nextNote
        }
      });
      setStageNoteState(stageId, nextNote);
      if (priceResult.value > 0) {
        const userState = getUserStageState(stageId) || { stageId };
        setUserStageState(stageId, {
          ...userState,
          actualTicketPrice: priceResult.value
        });
      }
      return { valid: true, data: nextNote };
    } catch (error) {
      return { valid: false, message: error.message || '备注保存失败' };
    }
  }

  persistStageNoteLocal(stageId, nextNote);
  return { valid: true, data: nextNote };
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

function formatAlbumNamesText(stage, albumNames = []) {
  const uniqueNames = Array.from(new Set(albumNames.filter(Boolean)));
  if (!uniqueNames.length) {
    return '未关联专辑';
  }
  const songAlbumIds = new Set(
    (stage.songs || []).map((song) => song.albumId).filter(Boolean)
  );
  if (uniqueNames.length >= 3) {
    return `${uniqueNames.slice(0, 3).join('、')}等`;
  }
  if (songAlbumIds.size > uniqueNames.length) {
    return `${uniqueNames.join('、')}等`;
  }
  return uniqueNames.join('、');
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
  const userState = getUserStageState(item.stageId);
  const albumNames = getStageAlbumNames(item);
  const validPriceTiers = getValidPriceTiers(item);
  return {
    ...item,
    albumNames,
    albumNamesText: formatAlbumNamesText(item, albumNames),
    priceTiers: validPriceTiers.length > 0 ? validPriceTiers : item.priceTiers || [],
    priceTierText: formatPriceTierText(item.priceTiers),
    ticketPrice: validPriceTiers[0] || Number(item.ticketPrice || 0),
    isLighted: Boolean(userState && userState.isLighted),
    lightTime: userState ? userState.lightTime : '',
    expenseId: userState ? userState.expenseId : '',
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
  const meetCategory = filter.stageType || 'all';
  return listStages().filter((item) => {
    const typeMatched = matchesMeetCategory(item, meetCategory);
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

function getStagesByMeetCategory(category) {
  return listStages().filter((item) => matchesMeetCategory(item, category));
}

function getStagesByType(stageType) {
  return listStages().filter((item) => item.stageType === stageType);
}

function getConcertStageOptions() {
  return getStagesByMeetCategory('concert').map((item) => ({
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
    .filter((item) => item.isLighted && !item.isCountdownPlaceholder)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());

  const futureCandidates = listStages()
    .filter((item) => parseDateValue(item.date))
    .filter((item) => parseDateValue(item.date).getTime() > todayDate.getTime())
    .filter((item) => item.isLighted || item.isCountdownPlaceholder)
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());

  const pastStages = meetStages.filter((item) => parseDateValue(item.date).getTime() <= todayDate.getTime());
  const lastMeet = pastStages[pastStages.length - 1];
  const nextMeet = futureCandidates[0];
  const firstMeet = meetStages[0];

  return {
    hasMeetStages: meetStages.length > 0 || Boolean(nextMeet),
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

function getLightedStages(meetCategory) {
  return listStages()
    .filter((item) => item.isLighted)
    .filter((item) => !meetCategory || matchesMeetCategory(item, meetCategory));
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

function getYearStats(year, meetCategory = 'all') {
  const targetYear = String(year || new Date().getFullYear());
  const lightedStages = getLightedStages(meetCategory === 'all' ? '' : meetCategory)
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

function listCountableStages() {
  return listStages().filter((item) => !item.isCountdownPlaceholder);
}

function getMeetCategoryCounts() {
  const list = listCountableStages();
  return {
    concert: list.filter((item) => matchesMeetCategory(item, 'concert')).length,
    special: list.filter((item) => matchesMeetCategory(item, 'special')).length
  };
}

function getMeetCategoryOptions() {
  const counts = getMeetCategoryCounts();
  return [
    { id: 'concert', name: `演唱会（${counts.concert}）` },
    { id: 'special', name: `运动会/新年音乐会（${counts.special}）` }
  ];
}

function getStageStats(meetCategory = 'all') {
  const list =
    meetCategory && meetCategory !== 'all'
      ? listCountableStages().filter((item) => matchesMeetCategory(item, meetCategory))
      : listCountableStages();
  const lightedStages = list.filter((item) => item.isLighted);
  const songStats = getSongStats(lightedStages);
  const progressPercent = list.length > 0 ? Math.round((lightedStages.length / list.length) * 100) : 0;
  return {
    total: list.length,
    lightedCount: lightedStages.length,
    unlockedSongCount: songStats.length,
    progressPercent
  };
}

function getLinkedExpense(stage) {
  if (!stage || !stage.isLighted) {
    return null;
  }
  const expenses = getExpenseList();
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
  const userState = getUserStageState(stageId);
  if (!userState || !userState.expenseId) {
    return false;
  }
  const expenses = getExpenseList();
  return expenses.some((item) => item.expenseId === userState.expenseId);
}

async function linkStageExpense(stageId, expenseId, actualTicketPrice = 0) {
  if (!stageId || !expenseId) {
    return;
  }
  if (config.useStageBackend) {
    try {
      await requestStageApi({
        url: '/user-stages/link-expense',
        method: 'POST',
        data: {
          userId: USER_ID,
          stageId,
          expenseId,
          actualTicketPrice
        }
      });
    } catch (error) {
      console.warn('关联消费记录失败', error);
      return;
    }
  } else {
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
  setUserStageState(stageId, {
    ...(getUserStageState(stageId) || { stageId }),
    isLighted: true,
    expenseId,
    lightTime: new Date().toISOString(),
    actualTicketPrice
  });
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
    title: '\u53d6\u6d88\u70b9\u4eae',
    content: hasLinkedExpense
      ? '\u53d6\u6d88\u70b9\u4eae\u5c06\u540c\u65f6\u5220\u9664\u5173\u8054\u7684\u6d88\u8d39\u8bb0\u5f55\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f'
      : '\u53d6\u6d88\u540e\u4f1a\u540c\u6b65\u66f4\u65b0\u6b4c\u66f2\u7edf\u8ba1\u548c\u4e13\u8f91\u8fdb\u5ea6\uff0c\u786e\u5b9a\u8981\u53d6\u6d88\u5417\uff1f',
    cancelText: '\u518d\u60f3\u60f3',
    confirmText: '\u53d6\u6d88\u70b9\u4eae',
    confirmColor: '#c84d69',
    success: async (res) => {
      if (!res.confirm) {
        return;
      }
      await unlightStage(stageId, { deleteExpense: hasLinkedExpense });
      wx.showToast({
        title: hasLinkedExpense ? '\u5df2\u53d6\u6d88\u5e76\u5220\u9664' : '\u5df2\u53d6\u6d88\u70b9\u4eae',
        icon: 'success'
      });
      if (callbacks.onDone) {
        callbacks.onDone({ deletedExpense: hasLinkedExpense });
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
  const expenseSeat = expense ? expense.seat || '' : '';
  const displaySeat = note.seat || expenseSeat;
  return {
    ...stage,
    note: {
      ...note,
      seat: displaySeat
    },
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

function getMeetMemoryReport(meetCategory = 'concert') {
  const typeName = getMeetCategoryName(meetCategory);
  const lightedMeetStages = getLightedStages(meetCategory)
    .filter((item) => parseDateValue(item.date))
    .sort((a, b) => parseDateValue(a.date).getTime() - parseDateValue(b.date).getTime());
  const cityRanking = buildRankMap(lightedMeetStages, 'cityName');
  const venueRanking = buildRankMap(lightedMeetStages, 'venueName');
  const firstStage = lightedMeetStages[0];
  const latestStage = lightedMeetStages[lightedMeetStages.length - 1];
  const topCity = cityRanking[0] || { name: '暂无记录', count: 0 };
  const topVenue = venueRanking[0] || { name: '暂无记录', count: 0 };

  return {
    stageType: meetCategory,
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

function getAnnualMemoryReport(year, meetCategory = 'all') {
  const targetYear = String(year || new Date().getFullYear());
  const expenseService = require('./expenseService');
  const lightedStages = getLightedStages()
    .filter((item) => matchesMeetCategory(item, meetCategory))
    .filter((item) => String(item.year) === targetYear);
  const songStats = getSongStats(lightedStages);
  const cityRanking = buildRankMap(lightedStages, 'cityName');
  const expenses = getExpenseList().filter((item) => {
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

function getMeetCalendar(year, meetCategory = 'concert') {
  const targetYear = String(year || new Date().getFullYear());
  const today = new Date();
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const lightedStages = getLightedStages(meetCategory === 'all' ? '' : meetCategory)
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
  ).map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

function setStageLighted(stageId, isLighted, options = {}) {
  return setStageLightedAsync(stageId, isLighted, options);
}

async function setStageLightedAsync(stageId, isLighted, options = {}) {
  if (!isLighted && options.deleteExpense) {
    const expenseService = require('./expenseService');
    const stage = listStages().find((item) => item.stageId === stageId);
    const linked = stage ? getLinkedExpense(stage) : null;
    if (linked) {
      if (config.useBackend) {
        await expenseService.removeExpenseAsync(linked.expenseId);
      } else {
        expenseService.removeExpense(linked.expenseId);
      }
      expenseListCache = null;
      await loadExpenseCache();
    }
  }

  if (config.useStageBackend) {
    try {
      await requestStageApi({
        url: `/user-stages/${isLighted ? 'light' : 'unlight'}`,
        method: 'POST',
        data: {
          userId: USER_ID,
          stageId,
          clearExpense: true
        }
      });
      const previous = getUserStageState(stageId) || { stageId };
      setUserStageState(stageId, {
        stageId,
        isLighted,
        lightTime: isLighted ? previous.lightTime || new Date().toISOString() : '',
        expenseId: isLighted ? previous.expenseId || '' : '',
        actualTicketPrice: isLighted ? Number(previous.actualTicketPrice || 0) : 0
      });
    } catch (error) {
      return { valid: false, message: error.message || '更新点亮状态失败' };
    }
  } else {
    persistUserStageStateLocal(stageId, isLighted, options);
  }

  if (!isLighted) {
    await clearStageNote(stageId);
  }

  return {
    valid: true,
    data: listStages().find((item) => item.stageId === stageId)
  };
}

function lightStage(stageId) {
  return setStageLightedAsync(stageId, true);
}

function unlightStage(stageId, options = {}) {
  return setStageLightedAsync(stageId, false, options);
}

function getStageById(stageId) {
  return stageCache.find((item) => item.stageId === stageId);
}

async function createExpenseFromStage(stageId, priceTier) {
  const expenseService = require('./expenseService');
  const stage = getStageById(stageId);
  if (!stage) {
    return { valid: false, message: '舞台场次不存在' };
  }
  const price = Number(priceTier || 0);
  if (price <= 0) {
    return { valid: false, message: '请先选择票档或输入有效票价' };
  }
  const payload = {
    category: 'meet',
    subType: inferExpenseSubType(stage),
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
  };
  const expenseResult = config.useBackend
    ? await expenseService.addExpenseAsync(payload)
    : expenseService.addExpense(payload);
  if (!expenseResult.valid) {
    return expenseResult;
  }

  await linkStageExpense(stageId, expenseResult.data.expenseId, price);
  expenseListCache = null;
  await loadExpenseCache();
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
    stats: getStageStats(filter.stageType || 'all'),
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
  getMeetCategoryOptions,
  getMeetCategoryCounts,
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
  getCompanionProfiles,
  getSongStats,
  getAlbumSongProgress,
  getYearStats,
  getStageStats,
  getStageDashboard,
  getStageDetail,
  getStageById,
  getStageNote,
  saveStageNote,
  getValidPriceTiers,
  promptPriceTier,
  getAllAlbumNames,
  getStageAlbumNames,
  hasStageLinkedExpense,
  getLinkedExpense,
  linkStageExpense,
  clearStageExpenseLink,
  confirmUnlightStage
};
