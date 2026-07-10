function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function formatDateText(value) {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function resolveStageTypeName(stageName, stageType) {
  const name = stageName || '';
  if (name.includes('新年音乐会')) {
    return '新年音乐会';
  }
  if (name.includes('运动会')) {
    return '运动会';
  }
  if (stageType === 'festival') {
    return '音乐节/拼盘';
  }
  return '演唱会';
}

function rowToStage(row, songs = [], album = null) {
  const songList = songs.map((item) => item.songName);
  const priceTiers = parseJson(row.price_tiers_json, []);
  return {
    stageId: row.stage_id,
    stageName: row.stage_name,
    stageType: row.stage_type,
    year: row.year,
    date: formatDateText(row.stage_date),
    city: row.city || '',
    venue: row.venue || '',
    location: row.location || row.city || '',
    albumId: row.album_id || '',
    albumName: album ? album.albumNameCn || album.albumName : row.album_id || '未关联专辑',
    albumNameCn: album ? album.albumNameCn || album.albumName : '',
    priceTiers,
    isOnline: Boolean(row.is_online),
    ticketPrice: Number(row.ticket_price || 0),
    description: row.description || '',
    songList,
    songs,
    songCount: songList.length,
    songListText: songList.join('、'),
    songPreviewText: songList.slice(0, 3).join('、') + (songList.length > 3 ? '…' : ''),
    priceTierText: priceTiers.map((price) => `${price}元`).join(' / '),
    cityName: row.city || row.location || '未填写城市',
    venueName: row.venue || row.stage_name || '未填写场馆',
    stageTypeName: resolveStageTypeName(row.stage_name, row.stage_type)
  };
}

function rowToAlbum(row, songs = []) {
  return {
    albumId: row.album_id,
    albumName: row.album_name,
    albumNameCn: row.album_name_cn || row.album_name,
    releaseYear: row.release_year,
    songs: songs.map((item) => ({
      songId: item.song_id,
      songName: item.song_name
    })),
    totalSongCount: songs.length
  };
}

module.exports = {
  parseJson,
  formatDateText,
  rowToStage,
  rowToAlbum
};
