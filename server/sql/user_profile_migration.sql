-- 目的：为真实微信用户增加自定义昵称和云存储头像字段
-- 涉及表：users
-- 风险：低；仅新增允许 NULL 的字段，不修改或删除现有数据

USE fan_accounting;

-- 执行前检查
SHOW CREATE TABLE users;
SHOW COLUMNS FROM users LIKE 'display_name';
SHOW COLUMNS FROM users LIKE 'avatar_file_id';
SELECT COUNT(*) AS users_total FROM users;

-- 仅在两个字段均不存在时执行
ALTER TABLE users
  ADD COLUMN display_name VARCHAR(40) COLLATE utf8mb4_unicode_ci NULL AFTER openid;

ALTER TABLE users
  ADD COLUMN avatar_file_id VARCHAR(500) COLLATE utf8mb4_bin NULL AFTER display_name;

-- 执行后验证
SHOW COLUMNS FROM users LIKE 'display_name';
SHOW COLUMNS FROM users LIKE 'avatar_file_id';
SELECT COUNT(*) AS users_total FROM users;
