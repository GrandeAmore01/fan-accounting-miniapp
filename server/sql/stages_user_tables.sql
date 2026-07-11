USE fan_accounting;

CREATE TABLE IF NOT EXISTS user_stages (
  user_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  stage_id VARCHAR(64) NOT NULL,
  is_lighted TINYINT(1) NOT NULL DEFAULT 0,
  light_time DATETIME NULL,
  expense_id VARCHAR(64) NOT NULL DEFAULT '',
  actual_ticket_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, stage_id),
  INDEX idx_user_stages_stage (stage_id),
  INDEX idx_user_stages_lighted (user_id, is_lighted),
  CONSTRAINT fk_user_stages_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_user_stages_stage
    FOREIGN KEY (stage_id) REFERENCES stages(stage_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stage_notes (
  user_id VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  stage_id VARCHAR(64) NOT NULL,
  seat VARCHAR(120) NOT NULL DEFAULT '',
  companions VARCHAR(500) NOT NULL DEFAULT '',
  note VARCHAR(1000) NOT NULL DEFAULT '',
  photos_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, stage_id),
  CONSTRAINT fk_stage_notes_user
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_stage_notes_stage
    FOREIGN KEY (stage_id) REFERENCES stages(stage_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
