USE fan_accounting;

-- 将旧版 collections 表升级为最终藏品图鉴字段结构。
ALTER TABLE collections
  CHANGE COLUMN category collection_category
    VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN primary_category VARCHAR(64) NOT NULL DEFAULT ''
    AFTER collection_category,
  ADD COLUMN secondary_category VARCHAR(64) NOT NULL DEFAULT ''
    AFTER primary_category,
  ADD COLUMN product_style VARCHAR(64) NOT NULL DEFAULT ''
    AFTER secondary_category;

ALTER TABLE collections
  DROP INDEX idx_collections_category,
  ADD INDEX idx_collections_category (
    collection_category, primary_category, secondary_category
  ),
  ADD INDEX idx_collections_style (product_style);
