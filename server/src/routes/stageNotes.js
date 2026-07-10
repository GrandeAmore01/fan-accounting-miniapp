const express = require('express');
const pool = require('../db');

const router = express.Router();

function parsePhotos(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function rowToStageNote(row) {
  return {
    stageId: row.stage_id,
    seat: row.seat || '',
    companions: row.companions || '',
    note: row.note || '',
    photos: parsePhotos(row.photos_json)
  };
}

router.get('/', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();
    if (!userId) {
      return res.status(400).json({ ok: false, message: '缺少userId' });
    }

    const [rows] = await pool.execute(
      `SELECT user_id, stage_id, seat, companions, note, photos_json
       FROM stage_notes
       WHERE user_id = ?
       ORDER BY stage_id ASC`,
      [userId]
    );

    res.json({
      ok: true,
      data: rows.map(rowToStageNote)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:stageId', async (req, res, next) => {
  try {
    const userId = String(req.query.userId || '').trim();
    const stageId = String(req.params.stageId || '').trim();
    if (!userId || !stageId) {
      return res.status(400).json({ ok: false, message: '缺少userId或stageId' });
    }

    const [rows] = await pool.execute(
      `SELECT user_id, stage_id, seat, companions, note, photos_json
       FROM stage_notes
       WHERE user_id = ? AND stage_id = ?
       LIMIT 1`,
      [userId, stageId]
    );

    if (!rows.length) {
      return res.json({
        ok: true,
        data: {
          stageId,
          seat: '',
          companions: '',
          note: '',
          photos: []
        }
      });
    }

    res.json({
      ok: true,
      data: rowToStageNote(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:stageId', async (req, res, next) => {
  try {
    const userId = String(req.body.userId || req.query.userId || '').trim();
    const stageId = String(req.params.stageId || '').trim();
    if (!userId || !stageId) {
      return res.status(400).json({ ok: false, message: '缺少userId或stageId' });
    }

    const [stages] = await pool.execute(
      `SELECT stage_id FROM stages WHERE stage_id = ?`,
      [stageId]
    );
    if (!stages.length) {
      return res.status(404).json({ ok: false, message: '舞台场次不存在' });
    }

    const seat = String(req.body.seat || '');
    const companions = String(req.body.companions || '');
    const note = String(req.body.note || '');
    const photos = parsePhotos(req.body.photos).slice(0, 9);
    const actualTicketPrice = Number(req.body.actualTicketPrice || 0);

    await pool.execute(
      `INSERT INTO stage_notes (
         user_id, stage_id, seat, companions, note, photos_json
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         seat = VALUES(seat),
         companions = VALUES(companions),
         note = VALUES(note),
         photos_json = VALUES(photos_json)`,
      [userId, stageId, seat, companions, note, JSON.stringify(photos)]
    );

    if (actualTicketPrice > 0) {
      await pool.execute(
        `INSERT INTO user_stages (
           user_id, stage_id, is_lighted, actual_ticket_price
         ) VALUES (?, ?, 0, ?)
         ON DUPLICATE KEY UPDATE
           actual_ticket_price = VALUES(actual_ticket_price)`,
        [userId, stageId, actualTicketPrice]
      );
    }

    res.json({
      ok: true,
      data: {
        stageId,
        seat,
        companions,
        note,
        photos,
        actualTicketPrice
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
