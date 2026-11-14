-- ============================================================================
-- Krishna Recharge — B2B Multi-Tier Recharge & BBPS MySQL Database Schema
-- ============================================================================

CREATE DATABASE IF NOT EXISTS krishna_recharge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE krishna_recharge;

-- 1. Commission Packages (Slabs assigned to Retailers, Distributors, MDs)
CREATE TABLE IF NOT EXISTS commission_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  role_target ENUM('ADMIN', 'MD', 'DISTRIBUTOR', 'RETAILER') NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users Table (Hierarchy via parent_id: ADMIN -> MD -> DISTRIBUTOR -> RETAILER)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  shop_name VARCHAR(120) NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  role ENUM('ADMIN', 'MD', 'DISTRIBUTOR', 'RETAILER') NOT NULL,
  parent_id INT NULL,
  package_id INT NOT NULL,
  wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  pin_hash VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_users_package FOREIGN KEY (package_id) REFERENCES commission_packages(id)
);

-- 3. Commission Slabs per Package & Operator
CREATE TABLE IF NOT EXISTS commission_slabs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  operator_code VARCHAR(20) NOT NULL,
  operator_name VARCHAR(60) NOT NULL,
  service_type ENUM('MOBILE', 'DTH', 'ELECTRICITY', 'FASTAG') NOT NULL DEFAULT 'MOBILE',
  commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  UNIQUE KEY uq_package_operator (package_id, operator_code),
  CONSTRAINT fk_slabs_package FOREIGN KEY (package_id) REFERENCES commission_packages(id) ON DELETE CASCADE
);

-- 4. Recharge & Bill Payment Transactions
CREATE TABLE IF NOT EXISTS recharges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  txn_ref VARCHAR(50) UNIQUE NOT NULL,
  user_id INT NOT NULL,
  mobile_number VARCHAR(24) NOT NULL,
  operator_code VARCHAR(20) NOT NULL,
  service_type ENUM('MOBILE', 'DTH', 'ELECTRICITY', 'FASTAG') NOT NULL DEFAULT 'MOBILE',
  amount DECIMAL(10, 2) NOT NULL,
  retailer_commission DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  net_debit DECIMAL(10, 2) NOT NULL,
  status ENUM('PENDING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
  api_txn_id VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_recharges_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. Wallet Ledger (Passbook - tracks every rupee with opening/closing balances)
CREATE TABLE IF NOT EXISTS wallet_ledger (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  txn_type ENUM('CREDIT', 'DEBIT') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  opening_balance DECIMAL(12, 2) NOT NULL,
  closing_balance DECIMAL(12, 2) NOT NULL,
  reference_id VARCHAR(64) NULL,
  remark VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ledger_user_created (user_id, created_at),
  CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. B2B Fund Requests (Retailer/Distributor -> Parent or Admin)
CREATE TABLE IF NOT EXISTS fund_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requester_id INT NOT NULL,
  approver_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  payment_mode ENUM('UPI', 'IMPS', 'NEFT', 'CASH') NOT NULL,
  utr_number VARCHAR(100) UNIQUE NOT NULL,
  remark VARCHAR(255) NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  action_remark VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_freq_requester FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT fk_freq_approver FOREIGN KEY (approver_id) REFERENCES users(id)
);

-- ============================================================================
-- Seed Default Packages & Commission Slabs
-- ============================================================================
INSERT INTO commission_packages (id, name, role_target, description) VALUES
  (1, 'Admin Root Pool', 'ADMIN', 'Top-level operator API payout rates'),
  (2, 'Master Distributor Platinum', 'MD', 'Master Distributor slab rates'),
  (3, 'Distributor Prime', 'DISTRIBUTOR', 'Area Distributor slab rates'),
  (4, 'Retailer Gold', 'RETAILER', 'Standard Retailer margin slab')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO commission_slabs (package_id, operator_code, operator_name, service_type, commission_percent) VALUES
  (1, 'JIO', 'Reliance Jio', 'MOBILE', 3.40),
  (1, 'AIRTEL', 'Bharti Airtel', 'MOBILE', 3.50),
  (1, 'VI', 'Vodafone Idea (Vi)', 'MOBILE', 4.00),
  (1, 'BSNL', 'BSNL Prepaid', 'MOBILE', 4.80),
  (1, 'TATAPLAY', 'Tata Play DTH', 'DTH', 3.80),
  (1, 'AIRTELDTH', 'Airtel Digital TV', 'DTH', 3.80),

  (2, 'JIO', 'Reliance Jio', 'MOBILE', 3.15),
  (2, 'AIRTEL', 'Bharti Airtel', 'MOBILE', 3.25),
  (2, 'VI', 'Vodafone Idea (Vi)', 'MOBILE', 3.70),
  (2, 'BSNL', 'BSNL Prepaid', 'MOBILE', 4.50),
  (2, 'TATAPLAY', 'Tata Play DTH', 'DTH', 3.50),
  (2, 'AIRTELDTH', 'Airtel Digital TV', 'DTH', 3.50),

  (3, 'JIO', 'Reliance Jio', 'MOBILE', 2.90),
  (3, 'AIRTEL', 'Bharti Airtel', 'MOBILE', 3.00),
  (3, 'VI', 'Vodafone Idea (Vi)', 'MOBILE', 3.45),
  (3, 'BSNL', 'BSNL Prepaid', 'MOBILE', 4.25),
  (3, 'TATAPLAY', 'Tata Play DTH', 'DTH', 3.25),
  (3, 'AIRTELDTH', 'Airtel Digital TV', 'DTH', 3.25),

  (4, 'JIO', 'Reliance Jio', 'MOBILE', 2.40),
  (4, 'AIRTEL', 'Bharti Airtel', 'MOBILE', 2.50),
  (4, 'VI', 'Vodafone Idea (Vi)', 'MOBILE', 3.10),
  (4, 'BSNL', 'BSNL Prepaid', 'MOBILE', 3.90),
  (4, 'TATAPLAY', 'Tata Play DTH', 'DTH', 2.90),
  (4, 'AIRTELDTH', 'Airtel Digital TV', 'DTH', 2.90)
ON DUPLICATE KEY UPDATE commission_percent = VALUES(commission_percent);
