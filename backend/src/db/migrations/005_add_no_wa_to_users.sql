-- Migration 005: Add no_wa to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS no_wa VARCHAR(20) DEFAULT NULL;
