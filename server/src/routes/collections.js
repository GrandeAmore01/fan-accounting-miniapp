const express = require('express');
const pool = require('../db');

const router = express.Router();

function formatDate(value) {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function rowToCollection(row) {
  return {
    collectionId: row.collection_id,
    collectionName: row.collection_name,
    saleType: row.sale_type,
    category: row.collection_category,
    collectionCategory: row.collection_category,
    primaryCategory: row.primary_category,
    secondaryCategory: row.secondary_category,
    productStyle: row.product_style,
    saleDate: formatDate(row.sale_date),
    saleDateText: row.sale_date_text,
    stageId: row.stage_id || '',
    referencePrice:
      row.reference_price === null
        ? null
        : Number(row.reference_price),
    priceText: row.price_text,
    acquisitionType: row.acquisition_type,
    priceNote: row.price_note,
    brand: row.brand,
    seriesName: row.series_name,
    imageUrl: row.image_url
  };
}

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM collections
       ORDER BY collection_id ASC`
    );

    res.json({
      ok: true,
      data: rows.map(rowToCollection)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const keyword = String(req.query.keyword || '').trim();
    const category = String(req.query.category || '').trim();
    const primaryCategory = String(req.query.primaryCategory || '').trim();
    const secondaryCategory = String(req.query.secondaryCategory || '').trim();
    const productStyle = String(req.query.productStyle || '').trim();

    const conditions = [];
    const params = [];

    if (keyword) {
      conditions.push(
        `(collection_name LIKE ?
          OR sale_type LIKE ?
          OR primary_category LIKE ?
          OR secondary_category LIKE ?
          OR product_style LIKE ?
          OR brand LIKE ?
          OR series_name LIKE ?)`
      );

      const pattern = `%${keyword}%`;
      params.push(
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern,
        pattern
      );
    }

    if (category) {
      conditions.push('collection_category = ?');
      params.push(category);
    }

    if (primaryCategory) {
      conditions.push('primary_category = ?');
      params.push(primaryCategory);
    }

    if (secondaryCategory) {
      conditions.push('secondary_category = ?');
      params.push(secondaryCategory);
    }

    if (productStyle) {
      conditions.push('product_style = ?');
      params.push(productStyle);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [rows] = await pool.execute(
      `SELECT *
       FROM collections
       ${whereClause}
       ORDER BY collection_name ASC, collection_id ASC
       LIMIT 50`,
      params
    );

    res.json({
      ok: true,
      data: rows.map(rowToCollection)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:collectionId', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT *
       FROM collections
       WHERE collection_id = ?
       LIMIT 1`,
      [req.params.collectionId]
    );

    if (!rows.length) {
      return res.status(404).json({
        ok: false,
        message: '藏品不存在'
      });
    }

    res.json({
      ok: true,
      data: rowToCollection(rows[0])
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
