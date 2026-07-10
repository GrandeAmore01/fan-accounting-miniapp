require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const password = String(process.env.DB_PASSWORD || '').trim();
  if (!password) {
    console.error('请先在 server/.env 填写 DB_PASSWORD（TiDB Connect → Reset Password）');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '../sql/stages_tidb_seed.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 4000),
    user: process.env.DB_USER,
    password,
    database: process.env.DB_NAME || 'fan_accounting',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    multipleStatements: true
  });

  console.log('正在连接 TiDB Cloud...');
  await connection.query(sql);
  const [[{ stageCount }]] = await connection.query('SELECT COUNT(*) AS stageCount FROM stages');
  const [[{ albumCount }]] = await connection.query('SELECT COUNT(*) AS albumCount FROM albums');
  const [[{ songCount }]] = await connection.query('SELECT COUNT(*) AS songCount FROM songs');
  await connection.end();

  console.log('导入完成');
  console.log(`stages: ${stageCount}, albums: ${albumCount}, songs: ${songCount}`);
}

main().catch((error) => {
  console.error('导入失败:', error.message);
  process.exit(1);
});
