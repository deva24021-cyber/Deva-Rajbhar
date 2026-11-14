import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {createServer as createViteServer} from 'vite';
import type {
  B2BUser,
  CommissionPackage,
  CommissionSlab,
  FundRequest,
  LedgerEntry,
  RechargeRecord,
} from './src/types.ts';

interface StoreData {
  nextUserId: number;
  nextRechargeId: number;
  nextLedgerId: number;
  nextFundRequestId: number;
  users: B2BUser[];
  packages: CommissionPackage[];
  slabs: CommissionSlab[];
  recharges: RechargeRecord[];
  ledger: LedgerEntry[];
  fundRequests: FundRequest[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

function buildInitialStore(): StoreData {
  const now = new Date().toISOString();
  return {
    nextUserId: 6,
    nextRechargeId: 3,
    nextLedgerId: 6,
    nextFundRequestId: 3,
    packages: [
      {id: 1, name: 'Admin Root Pool', roleTarget: 'ADMIN', description: 'Top-level operator API payout rates'},
      {id: 2, name: 'Master Distributor Platinum', roleTarget: 'MD', description: 'Master Distributor slab rates'},
      {id: 3, name: 'Distributor Prime', roleTarget: 'DISTRIBUTOR', description: 'Area Distributor slab rates'},
      {id: 4, name: 'Retailer Gold', roleTarget: 'RETAILER', description: 'Standard Retailer margin slab'},
    ],
    slabs: [
      // Package 1: Admin
      {id: 1, packageId: 1, operatorCode: 'JIO', operatorName: 'Reliance Jio', serviceType: 'MOBILE', commissionPercent: 3.4},
      {id: 2, packageId: 1, operatorCode: 'AIRTEL', operatorName: 'Bharti Airtel', serviceType: 'MOBILE', commissionPercent: 3.5},
      {id: 3, packageId: 1, operatorCode: 'VI', operatorName: 'Vodafone Idea (Vi)', serviceType: 'MOBILE', commissionPercent: 4.0},
      {id: 4, packageId: 1, operatorCode: 'BSNL', operatorName: 'BSNL Prepaid', serviceType: 'MOBILE', commissionPercent: 4.8},
      {id: 5, packageId: 1, operatorCode: 'TATAPLAY', operatorName: 'Tata Play DTH', serviceType: 'DTH', commissionPercent: 3.8},
      {id: 6, packageId: 1, operatorCode: 'AIRTELDTH', operatorName: 'Airtel Digital TV', serviceType: 'DTH', commissionPercent: 3.8},
      {id: 7, packageId: 1, operatorCode: 'MSEB', operatorName: 'MSEDCL Electricity', serviceType: 'ELECTRICITY', commissionPercent: 0.75},
      {id: 8, packageId: 1, operatorCode: 'FASTAG', operatorName: 'NHAI / Bank FASTag', serviceType: 'FASTAG', commissionPercent: 0.65},

      // Package 2: Master Distributor
      {id: 9, packageId: 2, operatorCode: 'JIO', operatorName: 'Reliance Jio', serviceType: 'MOBILE', commissionPercent: 3.15},
      {id: 10, packageId: 2, operatorCode: 'AIRTEL', operatorName: 'Bharti Airtel', serviceType: 'MOBILE', commissionPercent: 3.25},
      {id: 11, packageId: 2, operatorCode: 'VI', operatorName: 'Vodafone Idea (Vi)', serviceType: 'MOBILE', commissionPercent: 3.7},
      {id: 12, packageId: 2, operatorCode: 'BSNL', operatorName: 'BSNL Prepaid', serviceType: 'MOBILE', commissionPercent: 4.5},
      {id: 13, packageId: 2, operatorCode: 'TATAPLAY', operatorName: 'Tata Play DTH', serviceType: 'DTH', commissionPercent: 3.5},
      {id: 14, packageId: 2, operatorCode: 'AIRTELDTH', operatorName: 'Airtel Digital TV', serviceType: 'DTH', commissionPercent: 3.5},
      {id: 15, packageId: 2, operatorCode: 'MSEB', operatorName: 'MSEDCL Electricity', serviceType: 'ELECTRICITY', commissionPercent: 0.6},
      {id: 16, packageId: 2, operatorCode: 'FASTAG', operatorName: 'NHAI / Bank FASTag', serviceType: 'FASTAG', commissionPercent: 0.5},

      // Package 3: Distributor
      {id: 17, packageId: 3, operatorCode: 'JIO', operatorName: 'Reliance Jio', serviceType: 'MOBILE', commissionPercent: 2.9},
      {id: 18, packageId: 3, operatorCode: 'AIRTEL', operatorName: 'Bharti Airtel', serviceType: 'MOBILE', commissionPercent: 3.0},
      {id: 19, packageId: 3, operatorCode: 'VI', operatorName: 'Vodafone Idea (Vi)', serviceType: 'MOBILE', commissionPercent: 3.45},
      {id: 20, packageId: 3, operatorCode: 'BSNL', operatorName: 'BSNL Prepaid', serviceType: 'MOBILE', commissionPercent: 4.25},
      {id: 21, packageId: 3, operatorCode: 'TATAPLAY', operatorName: 'Tata Play DTH', serviceType: 'DTH', commissionPercent: 3.25},
      {id: 22, packageId: 3, operatorCode: 'AIRTELDTH', operatorName: 'Airtel Digital TV', serviceType: 'DTH', commissionPercent: 3.25},
      {id: 23, packageId: 3, operatorCode: 'MSEB', operatorName: 'MSEDCL Electricity', serviceType: 'ELECTRICITY', commissionPercent: 0.45},
      {id: 24, packageId: 3, operatorCode: 'FASTAG', operatorName: 'NHAI / Bank FASTag', serviceType: 'FASTAG', commissionPercent: 0.35},

      // Package 4: Retailer
      {id: 25, packageId: 4, operatorCode: 'JIO', operatorName: 'Reliance Jio', serviceType: 'MOBILE', commissionPercent: 2.4},
      {id: 26, packageId: 4, operatorCode: 'AIRTEL', operatorName: 'Bharti Airtel', serviceType: 'MOBILE', commissionPercent: 2.5},
      {id: 27, packageId: 4, operatorCode: 'VI', operatorName: 'Vodafone Idea (Vi)', serviceType: 'MOBILE', commissionPercent: 3.1},
      {id: 28, packageId: 4, operatorCode: 'BSNL', operatorName: 'BSNL Prepaid', serviceType: 'MOBILE', commissionPercent: 3.9},
      {id: 29, packageId: 4, operatorCode: 'TATAPLAY', operatorName: 'Tata Play DTH', serviceType: 'DTH', commissionPercent: 2.9},
      {id: 30, packageId: 4, operatorCode: 'AIRTELDTH', operatorName: 'Airtel Digital TV', serviceType: 'DTH', commissionPercent: 2.9},
      {id: 31, packageId: 4, operatorCode: 'MSEB', operatorName: 'MSEDCL Electricity', serviceType: 'ELECTRICITY', commissionPercent: 0.25},
      {id: 32, packageId: 4, operatorCode: 'FASTAG', operatorName: 'NHAI / Bank FASTag', serviceType: 'FASTAG', commissionPercent: 0.2},
    ],
    users: [
      {
        id: 1,
        name: 'Krishna HQ Admin',
        shopName: 'Krishna Recharge Central',
        phone: '9000000001',
        role: 'ADMIN',
        parentId: null,
        packageId: 1,
        walletBalance: 500000.0,
        tpin: '1234',
        isActive: true,
        createdAt: now,
      },
      {
        id: 2,
        name: 'Rajesh Sharma',
        shopName: 'Surya Telecom Zone',
        phone: '9811100002',
        role: 'MD',
        parentId: 1,
        packageId: 2,
        walletBalance: 85000.0,
        tpin: '1234',
        isActive: true,
        createdAt: now,
      },
      {
        id: 3,
        name: 'Vikram Patel',
        shopName: 'Patel Distribution',
        phone: '9822200003',
        role: 'DISTRIBUTOR',
        parentId: 2,
        packageId: 3,
        walletBalance: 24500.0,
        tpin: '1234',
        isActive: true,
        createdAt: now,
      },
      {
        id: 4,
        name: 'Anil Kumar',
        shopName: 'Sharma Mobile Point',
        phone: '9876543210',
        role: 'RETAILER',
        parentId: 3,
        packageId: 4,
        walletBalance: 4250.0,
        tpin: '1234',
        isActive: true,
        createdAt: now,
      },
      {
        id: 5,
        name: 'Deepak Verma',
        shopName: 'Balaji E-Mitra & Recharge',
        phone: '9833300005',
        role: 'RETAILER',
        parentId: 3,
        packageId: 4,
        walletBalance: 1850.0,
        tpin: '1234',
        isActive: true,
        createdAt: now,
      },
    ],
    recharges: [
      {
        id: 1,
        txnRef: 'KR8492011',
        userId: 4,
        mobileNumber: '9988776655',
        operatorCode: 'AIRTEL',
        operatorName: 'Bharti Airtel',
        serviceType: 'MOBILE',
        amount: 299,
        retailerCommission: 7.48,
        netDebit: 291.52,
        uplineCredits: [
          {userId: 3, userName: 'Vikram Patel', role: 'DISTRIBUTOR', rateDiff: 0.5, amount: 1.5},
          {userId: 2, userName: 'Rajesh Sharma', role: 'MD', rateDiff: 0.25, amount: 0.75},
        ],
        status: 'SUCCESS',
        apiTxnId: 'OP994128',
        createdAt: now,
      },
      {
        id: 2,
        txnRef: 'KR8492012',
        userId: 4,
        mobileNumber: '9123456780',
        operatorCode: 'JIO',
        operatorName: 'Reliance Jio',
        serviceType: 'MOBILE',
        amount: 719,
        retailerCommission: 17.26,
        netDebit: 701.74,
        uplineCredits: [
          {userId: 3, userName: 'Vikram Patel', role: 'DISTRIBUTOR', rateDiff: 0.5, amount: 3.6},
          {userId: 2, userName: 'Rajesh Sharma', role: 'MD', rateDiff: 0.25, amount: 1.8},
        ],
        status: 'SUCCESS',
        apiTxnId: 'OP994190',
        createdAt: now,
      },
    ],
    ledger: [
      {
        id: 1,
        userId: 4,
        txnType: 'CREDIT',
        amount: 5243.26,
        openingBalance: 0,
        closingBalance: 5243.26,
        referenceId: 'LOAD-INIT',
        remark: 'Received from Vikram Patel - Opening Float',
        createdAt: now,
      },
      {
        id: 2,
        userId: 4,
        txnType: 'DEBIT',
        amount: 291.52,
        openingBalance: 5243.26,
        closingBalance: 4951.74,
        referenceId: 'KR8492011',
        remark: 'Recharge AIRTEL 9988776655 (KR8492011)',
        createdAt: now,
      },
      {
        id: 3,
        userId: 4,
        txnType: 'DEBIT',
        amount: 701.74,
        openingBalance: 4951.74,
        closingBalance: 4250.0,
        referenceId: 'KR8492012',
        remark: 'Recharge JIO 9123456780 (KR8492012)',
        createdAt: now,
      },
      {
        id: 4,
        userId: 3,
        txnType: 'CREDIT',
        amount: 5.1,
        openingBalance: 24494.9,
        closingBalance: 24500.0,
        referenceId: 'KR8492012',
        remark: 'Upline Comm 0.50% (KR8492012)',
        createdAt: now,
      },
      {
        id: 5,
        userId: 2,
        txnType: 'CREDIT',
        amount: 2.55,
        openingBalance: 84997.45,
        closingBalance: 85000.0,
        referenceId: 'KR8492012',
        remark: 'Upline Comm 0.25% (KR8492012)',
        createdAt: now,
      },
    ],
    fundRequests: [
      {
        id: 1,
        requesterId: 4,
        approverId: 3,
        amount: 5000,
        paymentMode: 'UPI',
        utrNumber: 'UPI431982014412',
        remark: 'Morning counter float via PhonePe',
        status: 'PENDING',
        actionRemark: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        requesterId: 3,
        approverId: 1,
        amount: 25000,
        paymentMode: 'IMPS',
        utrNumber: 'IMPS9928172635',
        remark: 'Distributor settlement load',
        status: 'PENDING',
        actionRemark: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function readStore(): StoreData {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  if (!fs.existsSync(STORE_PATH)) {
    const initial = buildInitialStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as StoreData;
}

function writeStore(store: StoreData) {
  fs.mkdirSync(DATA_DIR, {recursive: true});
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function readArtifact(relPath: string, label: string) {
  const full = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(full)) return null;
  return {
    path: relPath,
    label,
    content: fs.readFileSync(full, 'utf8'),
  };
}

function executeTransferOnStore(
  store: StoreData,
  senderId: number,
  receiverId: number,
  amount: number,
  remark: string,
  referenceId: string
) {
  if (senderId === receiverId) throw new Error('Cannot transfer to your own wallet.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.');

  const sender = store.users.find((u) => u.id === senderId);
  const receiver = store.users.find((u) => u.id === receiverId);
  if (!sender || !receiver) throw new Error('Sender or receiver account not found.');

  if (sender.role !== 'ADMIN' && receiver.parentId !== sender.id) {
    throw new Error('Unauthorized: You can only transfer funds to your direct downline.');
  }

  const now = new Date().toISOString();

  if (sender.role !== 'ADMIN') {
    if (sender.walletBalance < amount) throw new Error('Insufficient balance in your wallet.');
    const open = sender.walletBalance;
    const close = +(open - amount).toFixed(2);
    sender.walletBalance = close;
    store.ledger.unshift({
      id: store.nextLedgerId++,
      userId: sender.id,
      txnType: 'DEBIT',
      amount,
      openingBalance: open,
      closingBalance: close,
      referenceId,
      remark: `Transfer to ${receiver.name} - ${remark}`,
      createdAt: now,
    });
  }

  const recOpen = receiver.walletBalance;
  const recClose = +(recOpen + amount).toFixed(2);
  receiver.walletBalance = recClose;
  store.ledger.unshift({
    id: store.nextLedgerId++,
    userId: receiver.id,
    txnType: 'CREDIT',
    amount,
    openingBalance: recOpen,
    closingBalance: recClose,
    referenceId,
    remark: `Received from ${sender.name} - ${remark}`,
    createdAt: now,
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/bootstrap', (_req, res) => {
    const store = readStore();
    const artifacts = [
      readArtifact('database/schema.sql', 'MySQL Schema (schema.sql)'),
      readArtifact('backend_api/server.js', 'Node.js API (backend_api/server.js)'),
      readArtifact('backend_api/package.json', 'Backend package.json'),
      readArtifact('mobile_app/lib/main.dart', 'Flutter App (mobile_app/lib/main.dart)'),
      readArtifact('.github/workflows/build_apk.yml', 'GitHub APK Workflow'),
      readArtifact('.gitignore', 'Unified .gitignore'),
    ].filter(Boolean);

    res.json({
      users: store.users,
      packages: store.packages,
      slabs: store.slabs,
      recharges: store.recharges,
      ledger: store.ledger,
      fundRequests: store.fundRequests,
      artifacts,
    });
  });

  app.post('/api/recharge', (req, res) => {
    const {userId, mobileNumber, operatorCode, amount, tpin} = req.body;
    const store = readStore();
    const rechargeAmt = Number(amount);

    const retailer = store.users.find((u) => u.id === Number(userId));
    if (!retailer) return res.status(404).json({success: false, message: 'User not found.'});
    if (String(tpin || '') !== retailer.tpin) {
      return res.status(401).json({success: false, message: 'Invalid Transaction PIN.'});
    }
    if (!mobileNumber || String(mobileNumber).trim().length < 6 || !Number.isFinite(rechargeAmt) || rechargeAmt <= 0) {
      return res.status(400).json({success: false, message: 'Enter valid subscriber ID and positive amount.'});
    }

    const slab = store.slabs.find((s) => s.packageId === retailer.packageId && s.operatorCode === operatorCode);
    if (!slab) return res.status(400).json({success: false, message: 'Operator slab not found for your package.'});

    const rate = slab.commissionPercent;
    const retailerComm = +((rechargeAmt * rate) / 100).toFixed(2);
    const netDebit = +(rechargeAmt - retailerComm).toFixed(2);

    if (retailer.walletBalance < netDebit) {
      return res.status(400).json({success: false, message: 'Insufficient wallet balance.'});
    }

    const txnRef = `KR${Date.now().toString().slice(-7)}`;
    const now = new Date().toISOString();
    const open = retailer.walletBalance;
    const close = +(open - netDebit).toFixed(2);
    retailer.walletBalance = close;

    store.ledger.unshift({
      id: store.nextLedgerId++,
      userId: retailer.id,
      txnType: 'DEBIT',
      amount: netDebit,
      openingBalance: open,
      closingBalance: close,
      referenceId: txnRef,
      remark: `Recharge ${slab.operatorCode} ${mobileNumber} (${txnRef})`,
      createdAt: now,
    });

    // Walk up hierarchy and distribute differential commission
    const uplineCredits: RechargeRecord['uplineCredits'] = [];
    let currentParentId = retailer.parentId;
    let previousRate = rate;

    while (currentParentId) {
      const parent = store.users.find((u) => u.id === currentParentId);
      if (!parent || parent.role === 'ADMIN') break;
      const parentSlab = store.slabs.find((s) => s.packageId === parent.packageId && s.operatorCode === operatorCode);
      const parentRate = parentSlab ? parentSlab.commissionPercent : previousRate;
      const diffRate = +(parentRate - previousRate).toFixed(2);

      if (diffRate > 0) {
        const commAmt = +((rechargeAmt * diffRate) / 100).toFixed(2);
        const pOpen = parent.walletBalance;
        const pClose = +(pOpen + commAmt).toFixed(2);
        parent.walletBalance = pClose;
        store.ledger.unshift({
          id: store.nextLedgerId++,
          userId: parent.id,
          txnType: 'CREDIT',
          amount: commAmt,
          openingBalance: pOpen,
          closingBalance: pClose,
          referenceId: txnRef,
          remark: `Upline Comm ${diffRate.toFixed(2)}% (${txnRef})`,
          createdAt: now,
        });
        uplineCredits.push({
          userId: parent.id,
          userName: parent.name,
          role: parent.role,
          rateDiff: diffRate,
          amount: commAmt,
        });
        previousRate = parentRate;
      }
      currentParentId = parent.parentId;
    }

    const record: RechargeRecord = {
      id: store.nextRechargeId++,
      txnRef,
      userId: retailer.id,
      mobileNumber: String(mobileNumber).trim(),
      operatorCode: slab.operatorCode,
      operatorName: slab.operatorName,
      serviceType: slab.serviceType,
      amount: rechargeAmt,
      retailerCommission: retailerComm,
      netDebit,
      uplineCredits,
      status: 'SUCCESS',
      apiTxnId: `OP${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: now,
    };

    store.recharges.unshift(record);
    writeStore(store);

    res.json({success: true, record});
  });

  app.post('/api/wallet/transfer', (req, res) => {
    const {senderId, receiverId, amount, tpin, remark} = req.body;
    const store = readStore();
    const sender = store.users.find((u) => u.id === Number(senderId));
    if (!sender) return res.status(404).json({success: false, message: 'Sender not found.'});
    if (sender.role === 'RETAILER') {
      return res.status(403).json({success: false, message: 'Retailers cannot transfer wallet funds.'});
    }
    if (String(tpin || '') !== sender.tpin) {
      return res.status(401).json({success: false, message: 'Invalid Transaction PIN.'});
    }

    try {
      const ref = `TRF${Date.now().toString().slice(-6)}`;
      executeTransferOnStore(
        store,
        sender.id,
        Number(receiverId),
        Number(amount),
        remark || 'Direct Wallet Load',
        ref
      );
      writeStore(store);
      res.json({success: true, message: 'Wallet transfer completed.'});
    } catch (err) {
      res.status(400).json({success: false, message: err instanceof Error ? err.message : 'Transfer failed.'});
    }
  });

  app.post('/api/wallet/fund-request', (req, res) => {
    const {requesterId, amount, paymentMode, utrNumber, requestTo, remark} = req.body;
    const store = readStore();
    const reqAmount = Number(amount);
    const requester = store.users.find((u) => u.id === Number(requesterId));
    if (!requester) return res.status(404).json({success: false, message: 'Requester not found.'});
    if (!Number.isFinite(reqAmount) || reqAmount <= 0) {
      return res.status(400).json({success: false, message: 'Valid positive amount required.'});
    }

    const adminUser = store.users.find((u) => u.role === 'ADMIN');
    const approverId = requestTo === 'ADMIN' || !requester.parentId ? adminUser!.id : requester.parentId;
    const mode = String(paymentMode || 'UPI').toUpperCase() as FundRequest['paymentMode'];
    const finalUtr =
      mode === 'CASH'
        ? `CASH-${Date.now().toString().slice(-6)}-${requester.id}`
        : String(utrNumber || '').trim().toUpperCase();

    if (mode !== 'CASH' && finalUtr.length < 6) {
      return res.status(400).json({success: false, message: 'Valid UTR / Reference number (min 6 chars) required.'});
    }

    if (store.fundRequests.some((fr) => fr.utrNumber === finalUtr)) {
      return res.status(400).json({success: false, message: 'This UTR number has already been submitted.'});
    }

    const now = new Date().toISOString();
    const newReq: FundRequest = {
      id: store.nextFundRequestId++,
      requesterId: requester.id,
      approverId,
      amount: reqAmount,
      paymentMode: mode,
      utrNumber: finalUtr,
      remark: String(remark || '').trim(),
      status: 'PENDING',
      actionRemark: '',
      createdAt: now,
      updatedAt: now,
    };

    store.fundRequests.unshift(newReq);
    writeStore(store);
    res.json({success: true, request: newReq});
  });

  app.post('/api/wallet/fund-request/action', (req, res) => {
    const {approverId, requestId, action, tpin, actionRemark} = req.body;
    const store = readStore();
    const approver = store.users.find((u) => u.id === Number(approverId));
    const fundReq = store.fundRequests.find((fr) => fr.id === Number(requestId));

    if (!approver || !fundReq) {
      return res.status(404).json({success: false, message: 'Approver or request not found.'});
    }
    if (fundReq.approverId !== approver.id && approver.role !== 'ADMIN') {
      return res.status(403).json({success: false, message: 'Not authorized to act on this request.'});
    }
    if (fundReq.status !== 'PENDING') {
      return res.status(400).json({success: false, message: `Request is already ${fundReq.status}.`});
    }

    const now = new Date().toISOString();

    if (action === 'REJECT') {
      fundReq.status = 'REJECTED';
      fundReq.actionRemark = actionRemark || 'Payment not verified';
      fundReq.updatedAt = now;
      writeStore(store);
      return res.json({success: true, message: 'Fund request rejected.'});
    }

    if (action === 'APPROVE') {
      if (String(tpin || '') !== approver.tpin) {
        return res.status(401).json({success: false, message: 'Invalid Transaction PIN.'});
      }
      try {
        executeTransferOnStore(
          store,
          approver.id,
          fundReq.requesterId,
          fundReq.amount,
          `Fund Req #${fundReq.id} (${fundReq.utrNumber})`,
          `FREQ-${fundReq.id}`
        );
        fundReq.status = 'APPROVED';
        fundReq.actionRemark = actionRemark || 'Approved';
        fundReq.updatedAt = now;
        writeStore(store);
        return res.json({success: true, message: `Approved ₹${fundReq.amount.toFixed(2)}.`});
      } catch (err) {
        return res.status(400).json({success: false, message: err instanceof Error ? err.message : 'Approval failed.'});
      }
    }

    res.status(400).json({success: false, message: 'Invalid action.'});
  });

  app.post('/api/users', (req, res) => {
    const {creatorId, name, shopName, phone, role, packageId} = req.body;
    const store = readStore();
    const creator = store.users.find((u) => u.id === Number(creatorId));
    if (!creator || creator.role === 'RETAILER') {
      return res.status(403).json({success: false, message: 'Retailers cannot onboard users.'});
    }
    const cleanPhone = String(phone || '').trim();
    if (!name || cleanPhone.length < 10) {
      return res.status(400).json({success: false, message: 'Valid name and 10-digit mobile number required.'});
    }
    if (store.users.some((u) => u.phone === cleanPhone)) {
      return res.status(400).json({success: false, message: 'Mobile number already registered.'});
    }

    const newUser: B2BUser = {
      id: store.nextUserId++,
      name: String(name).trim(),
      shopName: String(shopName || name).trim(),
      phone: cleanPhone,
      role,
      parentId: creator.id,
      packageId: Number(packageId),
      walletBalance: 0,
      tpin: '1234',
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    store.users.push(newUser);
    writeStore(store);
    res.json({success: true, user: newUser});
  });

  app.put('/api/slabs', (req, res) => {
    const {actorId, slabId, commissionPercent} = req.body;
    const store = readStore();
    const actor = store.users.find((u) => u.id === Number(actorId));
    if (!actor || actor.role !== 'ADMIN') {
      return res.status(403).json({success: false, message: 'Only Admin can modify commission slabs.'});
    }
    const slab = store.slabs.find((s) => s.id === Number(slabId));
    if (!slab) return res.status(404).json({success: false, message: 'Slab not found.'});

    const pct = Number(commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 15) {
      return res.status(400).json({success: false, message: 'Commission must be between 0% and 15%.'});
    }
    slab.commissionPercent = +pct.toFixed(2);
    writeStore(store);
    res.json({success: true, slab});
  });

  app.post('/api/reset-demo', (_req, res) => {
    const fresh = buildInitialStore();
    writeStore(fresh);
    res.json({success: true});
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {middlewareMode: true},
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Krishna Recharge server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
