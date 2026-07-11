USE fan_accounting;

ALTER TABLE expenses
  ADD COLUMN city VARCHAR(120) NOT NULL DEFAULT ''
    AFTER location,
  ADD COLUMN purchase_channel VARCHAR(32) NOT NULL DEFAULT 'none'
    AFTER city,
  ADD COLUMN pricing_mode VARCHAR(32) NOT NULL DEFAULT 'direct'
    AFTER purchase_channel,
  ADD COLUMN reference_price DECIMAL(10,2) NULL
    AFTER pricing_mode,
  ADD COLUMN unit_price DECIMAL(10,2) NULL
    AFTER reference_price,
  ADD COLUMN expense_source VARCHAR(32) NOT NULL DEFAULT 'manual'
    AFTER unit_price;

CREATE TABLE IF NOT EXISTS user_collections (
  user_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  collection_id VARCHAR(64) NOT NULL,
  is_owned TINYINT(1) NOT NULL DEFAULT 0,
  light_time DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, collection_id),
  INDEX idx_user_collections_collection (collection_id),
  INDEX idx_user_collections_owned (user_id, is_owned),
  CONSTRAINT fk_user_collections_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_collections_collection
    FOREIGN KEY (collection_id) REFERENCES collections(collection_id)
    ON DELETE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
