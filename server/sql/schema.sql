CREATE DATABASE IF NOT EXISTS fan_accounting
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE fan_accounting;

CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(64) PRIMARY KEY,
  nickname VARCHAR(100) NOT NULL DEFAULT '本地用户',
  login_status TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (user_id, nickname, login_status)
VALUES ('local-user', '本地用户', 0)
ON DUPLICATE KEY UPDATE user_id = user_id;

CREATE TABLE IF NOT EXISTS expenses (
  expense_id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  category VARCHAR(32) NOT NULL,
  sub_type VARCHAR(64) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  expense_date DATE NOT NULL,
  payment_method VARCHAR(64) NOT NULL DEFAULT '',
  seat VARCHAR(120) NOT NULL DEFAULT '',
  location VARCHAR(255) NOT NULL DEFAULT '',
  remark VARCHAR(500) NOT NULL DEFAULT '',
  images_json JSON NULL,
  fees_json JSON NULL,
  outfield_only TINYINT(1) NOT NULL DEFAULT 0,
  include_in_total TINYINT(1) NOT NULL DEFAULT 1,
  collection_id VARCHAR(64) NOT NULL DEFAULT '',
  stage_id VARCHAR(64) NOT NULL DEFAULT '',
  stage_date VARCHAR(32) NOT NULL DEFAULT '',
  price_tier VARCHAR(32) NOT NULL DEFAULT '',
  base_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  included_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expenses_user_date (user_id, expense_date),
  INDEX idx_expenses_user_category (user_id, category),
  CONSTRAINT fk_expenses_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
