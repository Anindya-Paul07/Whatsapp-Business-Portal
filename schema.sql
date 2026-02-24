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
  source     ENUM('manual','csv') NOT NULL DEFAULT 'manual',
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
  status     ENUM('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  sent_count INT UNSIGNED DEFAULT 0,
  fail_count INT UNSIGNED DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
--  TEMPLATE BOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS template_bots (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  keyword     VARCHAR(500) NOT NULL,
  reply_text  TEXT         NOT NULL,
  reply_type  ENUM('exact','contains') NOT NULL DEFAULT 'contains',
  is_active   TINYINT(1)   NOT NULL DEFAULT 1,
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
