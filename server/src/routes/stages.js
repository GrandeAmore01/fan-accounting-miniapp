const express = require('express');
const pool = require('../db');
const { rowToStage, rowToAlbum } = require('../utils/stageModel');

const router = express.Router();

async function fetchStageBundle() {
  const [stageRows] = await pool.execute(
    `SELECT *
     FROM stages
     ORDER BY stage_date DESC, sort_order ASC`
  );
  const [stageSongRows] = await pool.execute(
    `SELECT ss.stage_id, s.song_id, s.song_name, s.album_id, ss.sort_order
     FROM stage_songs ss
     INNER JOIN songs s ON s.song_id = ss.song_id
     ORDER BY ss.stage_id ASC, ss.sort_order ASC`
  );
  const [albumRows] = await pool.execute(
    `SELECT album_id, album_name, album_name_cn, release_year, sort_order
     FROM albums
     ORDER BY sort_order ASC`
  );
  const [allSongRows] = await pool.execute(
    `SELECT song_id, song_name, album_id, sort_order
     FROM songs
     ORDER BY album_id ASC, sort_order ASC`
  );
  const albumMap = {};
  albumRows.forEach((row) => {
    albumMap[row.album_id] = rowToAlbum(
      row,
      allSongRows.filter((song) => song.album_id === row.album_id)
    );
  });
  const songsByStage = {};
  stageSongRows.forEach((row) => {
    if (!songsByStage[row.stage_id]) {
      songsByStage[row.stage_id] = [];
    }
    songsByStage[row.stage_id].push({
      songId: row.song_id,
      songName: row.song_name,
      albumId: row.album_id
    });
  });
  const stages = stageRows.map((row) =>
    rowToStage(row, songsByStage[row.stage_id] || [], albumMap[row.album_id] || null)
  );
  return {
    stages,
    albums: albumRows.map((row) =>
      rowToAlbum(row, allSongRows.filter((song) => song.album_id === row.album_id))
    )
  };
}

router.get('/', async (req, res, next) => {
  try {
    const data = await fetchStageBundle();
    res.json({
      ok: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const keyword = (req.query.keyword || '').trim();
    const data = await fetchStageBundle();
    if (!keyword) {
      return res.json({ ok: true, data: [] });
    }
    const songMap = {};
    data.stages.forEach((stage) => {
      (stage.songList || []).forEach((songName) => {
        if (songName.indexOf(keyword) < 0) {
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
    const results = Object.keys(songMap)
      .map((key) => songMap[key])
      .sort((a, b) => a.songName.localeCompare(b.songName, 'zh-CN'));
    res.json({
      ok: true,
      data: results
    });
  } catch (error) {
    next(error);
  }
});

router.get('/albums/progress', async (req, res, next) => {
  try {
    const [albumRows] = await pool.execute(
      `SELECT album_id, album_name, album_name_cn, release_year, sort_order
       FROM albums
       ORDER BY sort_order ASC`
    );
    const [songRows] = await pool.execute(
      `SELECT song_id, song_name, album_id, sort_order
       FROM songs
       ORDER BY album_id ASC, sort_order ASC`
    );
    const albums = albumRows.map((row) => {
      const songs = songRows
        .filter((song) => song.album_id === row.album_id)
        .map((song) => ({
          songId: song.song_id,
          songName: song.song_name
        }));
      return rowToAlbum(row, songRows.filter((song) => song.album_id === row.album_id));
    });
    res.json({
      ok: true,
      data: albums
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:stageId', async (req, res, next) => {
  try {
    const data = await fetchStageBundle();
    const stage = data.stages.find((item) => item.stageId === req.params.stageId);
    if (!stage) {
      return res.status(404).json({ ok: false, message: '舞台场次不存在' });
    }
    return res.json({
      ok: true,
      data: stage
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
