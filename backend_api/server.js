require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'dev_krishna_recharge_secret';

// ============================================================================
// MySQL Connection Pool
// ============================================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'krishna_recharge',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ============================================================================
// Auth Middleware (JWT)
// ============================================================================
function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authorization token required.' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ============================================================================
// Health Check
// ============================================================================
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, service: 'krishna-recharge-api', database: 'connected' });
  } catch (err) {
    res.status(500).json({ success: false, service: 'krishna-recharge-api', error: err.message });
  }
});

// ============================================================================
// Auth: Login with Phone + Password
// ============================================================================
app.post('/api/auth/login', async (req, res) => {
  const { phone, password } = req.body;
  try {
    const [rows] = await pool.query(
      'SELECT id, name, shop_name, phone, role, parent_id, package_id, wallet_balance, password_hash, is_active FROM users WHERE phone = ? LIMIT 1',
      [String(phone || '').trim()]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid phone or password.' });
    }
    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is suspended.' });
    }
    const valid = await bcrypt.compare(String(password || ''), user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid phone or password.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role, phone: user.phone }, JWT_SECRET, {
      expiresIn: '12h',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        shopName: user.shop_name,
        phone: user.phone,
        role: user.role,
        walletBalance: parseFloat(user.wallet_balance),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// Helper: Atomic Deadlock-Safe Wallet Transfer
// ============================================================================
async function executeWalletTransfer(conn, senderId, receiverId, amount, remark, referenceId = null) {
  if (senderId === receiverId) throw new Error('Cannot transfer to your own wallet.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');

  const firstId = Math.min(senderId, receiverId);
  const secondId = Math.max(senderId, receiverId);

  const [users] = await conn.query(
    'SELECT id, name, role, parent_id, wallet_balance FROM users WHERE id IN (?, ?) ORDER BY id ASC FOR UPDATE',
    [firstId, secondId]
  );
  if (users.length !== 2) throw new Error('Sender or receiver account not found.');

  const sender = users.find((u) => u.id === senderId);
  const receiver = users.find((u) => u.id === receiverId);

  if (sender.role !== 'ADMIN' && receiver.parent_id !== sender.id) {
    throw new Error('Unauthorized: You can only transfer funds to your direct downline.');
  }

  let senderNewBalance = null;
  if (sender.role !== 'ADMIN') {
    const senderOpen = parseFloat(sender.wallet_balance);
    if (senderOpen < amount) throw new Error('Insufficient balance in your wallet.');

    const senderClose = +(senderOpen - amount).toFixed(2);
    await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [senderClose, sender.id]);
    await conn.query(
      'INSERT INTO wallet_ledger (user_id, txn_type, amount, opening_balance, closing_balance, reference_id, remark) VALUES (?, "DEBIT", ?, ?, ?, ?, ?)',
      [sender.id, amount, senderOpen, senderClose, referenceId, `Transfer to ${receiver.name} - ${remark}`]
    );
    senderNewBalance = senderClose;
  }

  const recOpen = parseFloat(receiver.wallet_balance);
  const recClose = +(recOpen + amount).toFixed(2);
  await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [recClose, receiver.id]);
  await conn.query(
    'INSERT INTO wallet_ledger (user_id, txn_type, amount, opening_balance, closing_balance, reference_id, remark) VALUES (?, "CREDIT", ?, ?, ?, ?, ?)',
    [receiver.id, amount, recOpen, recClose, referenceId, `Received from ${sender.name} - ${remark}`]
  );

  return { senderNewBalance, receiverNewBalance: recClose };
}

// ============================================================================
// 1. DIRECT WALLET TRANSFER (Admin / MD / Distributor -> Downline)
// ============================================================================
app.post('/api/wallet/transfer', authMiddleware, async (req, res) => {
  const senderId = req.user.id;
  const { receiverId, amount, tpin, remark } = req.body;
  const transferAmount = parseFloat(amount);

  if (req.user.role === 'RETAILER') {
    return res.status(403).json({ success: false, message: 'Retailers cannot transfer wallet funds.' });
  }

  const conn = await pool.getConnection();
  try {
    const [senderRows] = await conn.query('SELECT pin_hash FROM users WHERE id = ?', [senderId]);
    if (!senderRows.length) throw new Error('Sender account not found.');

    const validPin = await bcrypt.compare(String(tpin || ''), senderRows[0].pin_hash);
    if (!validPin) {
      return res.status(401).json({ success: false, message: 'Invalid Transaction PIN.' });
    }

    await conn.beginTransaction();
    const result = await executeWalletTransfer(
      conn,
      senderId,
      parseInt(receiverId, 10),
      transferAmount,
      remark || 'Direct Wallet Load'
    );
    await conn.commit();

    res.json({ success: true, message: `INR ${transferAmount.toFixed(2)} transferred successfully.`, data: result });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ============================================================================
// 2. SUBMIT FUND REQUEST (Retailer / Distributor -> Parent or Admin)
// ============================================================================
app.post('/api/wallet/fund-request', authMiddleware, async (req, res) => {
  const requesterId = req.user.id;
  const { amount, paymentMode, utrNumber, requestTo, remark } = req.body;
  const reqAmount = parseFloat(amount);

  if (!Number.isFinite(reqAmount) || reqAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid positive amount is required.' });
  }

  try {
    const [userRows] = await pool.query('SELECT parent_id FROM users WHERE id = ?', [requesterId]);
    let approverId = userRows[0]?.parent_id || null;

    if (requestTo === 'ADMIN' || !approverId) {
      const [admins] = await pool.query('SELECT id FROM users WHERE role = "ADMIN" LIMIT 1');
      if (!admins.length) throw new Error('No Admin account configured.');
      approverId = admins[0].id;
    }

    const mode = String(paymentMode || 'UPI').toUpperCase();
    const finalUtr =
      mode === 'CASH'
        ? `CASH-${Date.now()}-${requesterId}`
        : String(utrNumber || '').trim().toUpperCase();

    if (mode !== 'CASH' && finalUtr.length < 6) {
      return res.status(400).json({ success: false, message: 'Valid UTR / Reference number is required.' });
    }

    const [insertRes] = await pool.query(
      'INSERT INTO fund_requests (requester_id, approver_id, amount, payment_mode, utr_number, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [requesterId, approverId, reqAmount, mode, finalUtr, remark || '']
    );

    res.json({
      success: true,
      requestId: insertRes.insertId,
      message: 'Fund request submitted. Waiting for approval.',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'This UTR number has already been submitted.' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 3. APPROVE OR REJECT FUND REQUEST
// ============================================================================
app.post('/api/wallet/fund-request/action', authMiddleware, async (req, res) => {
  const approverId = req.user.id;
  const { requestId, action, tpin, actionRemark } = req.body;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [reqRows] = await conn.query('SELECT * FROM fund_requests WHERE id = ? FOR UPDATE', [requestId]);
    if (!reqRows.length) throw new Error('Fund request not found.');

    const fundReq = reqRows[0];
    if (fundReq.approver_id !== approverId && req.user.role !== 'ADMIN') {
      throw new Error('You are not authorized to act on this request.');
    }
    if (fundReq.status !== 'PENDING') {
      throw new Error(`Request is already ${fundReq.status}.`);
    }

    if (action === 'REJECT') {
      await conn.query(
        'UPDATE fund_requests SET status = "REJECTED", action_remark = ? WHERE id = ?',
        [actionRemark || 'Payment not received', requestId]
      );
      await conn.commit();
      return res.json({ success: true, message: 'Fund request rejected.' });
    }

    if (action === 'APPROVE') {
      const [appRows] = await conn.query('SELECT pin_hash FROM users WHERE id = ?', [approverId]);
      const validPin = await bcrypt.compare(String(tpin || ''), appRows[0].pin_hash);
      if (!validPin) throw new Error('Invalid Transaction PIN.');

      await executeWalletTransfer(
        conn,
        approverId,
        fundReq.requester_id,
        parseFloat(fundReq.amount),
        `Fund Req #${fundReq.id} (${fundReq.utr_number})`,
        `FREQ-${fundReq.id}`
      );

      await conn.query(
        'UPDATE fund_requests SET status = "APPROVED", action_remark = ? WHERE id = ?',
        [actionRemark || 'Approved', requestId]
      );

      await conn.commit();
      return res.json({ success: true, message: `Approved INR ${fundReq.amount} successfully.` });
    }

    throw new Error('Invalid action.');
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ============================================================================
// 4. B2B RECHARGE WITH UPLINE COMMISSION DISTRIBUTION
// ============================================================================
async function creditUplineCommission(conn, parentId, lowerRate, operatorCode, amount, txnRef) {
  let currentParentId = parentId;
  let previousRate = lowerRate;

  while (currentParentId) {
    const [parents] = await conn.query(
      'SELECT id, role, parent_id, package_id, wallet_balance FROM users WHERE id = ? FOR UPDATE',
      [currentParentId]
    );
    if (!parents.length || parents[0].role === 'ADMIN') break;

    const parent = parents[0];
    const [slabs] = await conn.query(
      'SELECT commission_percent FROM commission_slabs WHERE package_id = ? AND operator_code = ?',
      [parent.package_id, operatorCode]
    );
    const parentRate = slabs.length ? parseFloat(slabs[0].commission_percent) : previousRate;
    const diffRate = +(parentRate - previousRate).toFixed(2);

    if (diffRate > 0) {
      const commAmount = +((amount * diffRate) / 100).toFixed(2);
      const openBal = parseFloat(parent.wallet_balance);
      const closeBal = +(openBal + commAmount).toFixed(2);

      await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [closeBal, parent.id]);
      await conn.query(
        'INSERT INTO wallet_ledger (user_id, txn_type, amount, opening_balance, closing_balance, reference_id, remark) VALUES (?, "CREDIT", ?, ?, ?, ?, ?)',
        [parent.id, commAmount, openBal, closeBal, txnRef, `Upline Comm ${diffRate}% (${txnRef})`]
      );
      previousRate = parentRate;
    }
    currentParentId = parent.parent_id;
  }
}

app.post('/api/recharge', authMiddleware, async (req, res) => {
  const retailerId = req.user.id;
  const { mobileNumber, operatorCode, serviceType, amount, tpin } = req.body;
  const rechargeAmount = parseFloat(amount);

  if (!mobileNumber || !operatorCode || !Number.isFinite(rechargeAmount) || rechargeAmount <= 0) {
    return res.status(400).json({ success: false, message: 'Valid subscriber ID, operator, and amount required.' });
  }

  const conn = await pool.getConnection();
  const txnRef = `KR${Date.now()}`;

  try {
    await conn.beginTransaction();

    const [users] = await conn.query(
      'SELECT id, wallet_balance, package_id, parent_id, pin_hash FROM users WHERE id = ? FOR UPDATE',
      [retailerId]
    );
    if (!users.length) throw new Error('User not found.');
    const retailer = users[0];

    const validPin = await bcrypt.compare(String(tpin || ''), retailer.pin_hash);
    if (!validPin) throw new Error('Invalid Transaction PIN.');

    const [slabs] = await conn.query(
      'SELECT commission_percent FROM commission_slabs WHERE package_id = ? AND operator_code = ?',
      [retailer.package_id, operatorCode]
    );
    const rate = slabs.length ? parseFloat(slabs[0].commission_percent) : 0;
    const retailerComm = +((rechargeAmount * rate) / 100).toFixed(2);
    const netDebit = +(rechargeAmount - retailerComm).toFixed(2);

    const openBal = parseFloat(retailer.wallet_balance);
    if (openBal < netDebit) throw new Error('Insufficient wallet balance.');

    const closeBal = +(openBal - netDebit).toFixed(2);
    await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [closeBal, retailer.id]);
    await conn.query(
      'INSERT INTO wallet_ledger (user_id, txn_type, amount, opening_balance, closing_balance, reference_id, remark) VALUES (?, "DEBIT", ?, ?, ?, ?, ?)',
      [retailer.id, netDebit, openBal, closeBal, txnRef, `Recharge ${operatorCode} ${mobileNumber} (${txnRef})`]
    );
    await conn.query(
      'INSERT INTO recharges (txn_ref, user_id, mobile_number, operator_code, service_type, amount, retailer_commission, net_debit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "PENDING")',
      [txnRef, retailer.id, mobileNumber, operatorCode, serviceType || 'MOBILE', rechargeAmount, retailerComm, netDebit]
    );
    await conn.commit();

    // Call External Operator API
    let apiStatus = 'SUCCESS';
    let apiTxnId = `OP${Date.now()}`;
    if (process.env.RECHARGE_API_URL && !process.env.RECHARGE_API_URL.includes('rechargeprovider.com')) {
      const apiRes = await axios.post(
        process.env.RECHARGE_API_URL,
        { number: mobileNumber, operator: operatorCode, amount: rechargeAmount, client_ref: txnRef },
        { headers: { Authorization: `Bearer ${process.env.RECHARGE_API_KEY || ''}` }, timeout: 15000 }
      );
      apiStatus = apiRes.data?.status || 'PENDING';
      apiTxnId = apiRes.data?.api_id || apiTxnId;
    }

    if (apiStatus === 'SUCCESS') {
      await conn.beginTransaction();
      await conn.query('UPDATE recharges SET status = "SUCCESS", api_txn_id = ? WHERE txn_ref = ?', [apiTxnId, txnRef]);
      await creditUplineCommission(conn, retailer.parent_id, rate, operatorCode, rechargeAmount, txnRef);
      await conn.commit();
      return res.json({ success: true, status: 'SUCCESS', txnRef, commissionEarned: retailerComm, netDebit });
    }

    if (apiStatus === 'FAILED') {
      await conn.beginTransaction();
      await conn.query('UPDATE recharges SET status = "FAILED" WHERE txn_ref = ?', [txnRef]);
      const [uRows] = await conn.query('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [retailer.id]);
      const rOpen = parseFloat(uRows[0].wallet_balance);
      const rClose = +(rOpen + netDebit).toFixed(2);
      await conn.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [rClose, retailer.id]);
      await conn.query(
        'INSERT INTO wallet_ledger (user_id, txn_type, amount, opening_balance, closing_balance, reference_id, remark) VALUES (?, "CREDIT", ?, ?, ?, ?, ?)',
        [retailer.id, netDebit, rOpen, rClose, txnRef, `Auto-Refund (${txnRef})`]
      );
      await conn.commit();
      return res.status(400).json({ success: false, status: 'FAILED', message: 'Recharge failed. Amount refunded.' });
    }

    return res.json({ success: true, status: 'PENDING', txnRef });
  } catch (err) {
    await conn.rollback();
    res.status(400).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// ============================================================================
// 5. LEDGER & FUND REQUEST LISTING
// ============================================================================
app.get('/api/wallet/ledger', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM wallet_ledger WHERE user_id = ? ORDER BY id DESC LIMIT 100',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/wallet/fund-requests', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM fund_requests WHERE requester_id = ? OR approver_id = ? ORDER BY id DESC LIMIT 100',
      [req.user.id, req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Krishna Recharge Node.js API listening on port ${PORT}`);
});
