USE fan_accounting;

-- 第一阶段：微信身份
ALTER TABLE users
  ADD COLUMN openid VARCHAR(128) NULL AFTER user_id,
  ADD UNIQUE INDEX uk_users_openid (openid);

-- 第二阶段：云端预算
CREATE TABLE IF NOT EXISTS budgets (
  budget_id VARCHAR(160) PRIMARY KEY,
  user_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  budget_type ENUM('month', 'year') NOT NULL,
  period VARCHAR(7) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  threshold DECIMAL(5,4) NOT NULL DEFAULT 0.8000,
  category_budgets_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX uk_budgets_user_period (user_id, budget_type, period),
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
