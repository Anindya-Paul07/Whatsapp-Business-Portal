-- ============================================================
--  WhatsApp Marketing Platform - Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS whatsapp_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE whatsapp_platform;

-- ============================================================
--  USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
--  CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  phone      VARCHAR(30)  NOT NULL,
  labels     VARCHAR(500) DEFAULT NULL COMMENT 'Comma-separated labels',
  source     ENUM('manual','csv','customer_inquiry','imported_lead','unknown') NOT NULL DEFAULT 'manual',
  do_not_message TINYINT(1) NOT NULL DEFAULT 0,
  consent_status ENUM('can_message','do_not_message','unknown') NOT NULL DEFAULT 'unknown',
  opt_out_at DATETIME DEFAULT NULL,
  source_detail VARCHAR(255) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_phone (user_id, phone),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  name       VARCHAR(255) NOT NULL,
  message    TEXT         NOT NULL,
  media_url  VARCHAR(500) DEFAULT NULL,
  status     ENUM('pending','processing','paused','completed','failed') NOT NULL DEFAULT 'pending',
  sent_count INT UNSIGNED DEFAULT 0,
  fail_count INT UNSIGNED DEFAULT 0,
  skipped_count INT UNSIGNED DEFAULT 0,
  template_id INT UNSIGNED DEFAULT NULL,
  audience_type VARCHAR(50) DEFAULT NULL,
  audience_snapshot_json JSON DEFAULT NULL,
  scheduled_at DATETIME DEFAULT NULL,
  started_at DATETIME DEFAULT NULL,
  finished_at DATETIME DEFAULT NULL,
  paused_at DATETIME DEFAULT NULL,
  batch_limit INT UNSIGNED DEFAULT 50,
  delay_min_seconds INT UNSIGNED DEFAULT 20,
  delay_max_seconds INT UNSIGNED DEFAULT 45,
  deep_pause_every INT UNSIGNED DEFAULT 15,
  deep_pause_min_minutes INT UNSIGNED DEFAULT 5,
  deep_pause_max_minutes INT UNSIGNED DEFAULT 10,
  send_window_start TIME DEFAULT '10:00:00',
  send_window_end TIME DEFAULT '20:00:00',
  failure_pause_threshold INT UNSIGNED DEFAULT 10,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   INT UNSIGNED NOT NULL,
  contact_id    INT UNSIGNED DEFAULT NULL,
  name          VARCHAR(255) DEFAULT NULL,
  phone         VARCHAR(30) NOT NULL,
  status        ENUM('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
  failure_code  VARCHAR(50) DEFAULT NULL,
  error_message TEXT DEFAULT NULL,
  sent_at       DATETIME DEFAULT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_campaign_status (campaign_id, status),
  INDEX idx_campaign_phone (campaign_id, phone),
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
--  TEMPLATE BOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_bots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  keyword     VARCHAR(500) NOT NULL,
  reply_text  TEXT         NOT NULL,
  reply_type  ENUM('exact','contains') NOT NULL DEFAULT 'contains',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  priority     INT UNSIGNED NOT NULL DEFAULT 100,
  is_system    TINYINT(1)   NOT NULL DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  CHAT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_logs (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  contact_phone VARCHAR(30)  NOT NULL,
  body          TEXT         NOT NULL,
  direction     ENUM('in','out') NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_phone (user_id, contact_phone),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
