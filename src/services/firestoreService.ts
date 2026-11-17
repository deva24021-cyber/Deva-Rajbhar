import type {User as FirebaseUser} from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {OperationType, db, handleFirestoreError} from '../firebase';
import type {
  B2BUser,
  CommissionPackage,
  CommissionSlab,
  FundRequest,
  LedgerEntry,
  PaymentMode,
  RechargeRecord,
  ServiceType,
  UserRole,
} from '../types';

export const BOOTSTRAP_ADMIN_EMAIL = 'deva24021@gmail.com';

const DEFAULT_PACKAGES: Omit<CommissionPackage, 'updatedAt'>[] = [
  {
    id: 'pkg_admin_root',
    name: 'Admin Root Pool',
    roleTarget: 'ADMIN',
    description: 'Top-level operator API payout rates',
  },
  {
    id: 'pkg_md_platinum',
    name: 'Master Distributor Platinum',
    roleTarget: 'MD',
    description: 'Master Distributor slab rates',
  },
  {
    id: 'pkg_dist_prime',
    name: 'Distributor Prime',
    roleTarget: 'DISTRIBUTOR',
    description: 'Area Distributor slab rates',
  },
  {
    id: 'pkg_retailer_gold',
    name: 'Retailer Gold',
    roleTarget: 'RETAILER',
    description: 'Standard Retailer margin slab',
  },
];

const OPERATOR_SEEDS: {
  operatorCode: string;
  operatorName: string;
  serviceType: ServiceType;
  rates: Record<string, number>;
}[] = [
  {
    operatorCode: 'JIO',
    operatorName: 'Reliance Jio',
    serviceType: 'MOBILE',
    rates: {pkg_admin_root: 3.4, pkg_md_platinum: 3.15, pkg_dist_prime: 2.9, pkg_retailer_gold: 2.4},
  },
  {
    operatorCode: 'AIRTEL',
    operatorName: 'Bharti Airtel',
    serviceType: 'MOBILE',
    rates: {pkg_admin_root: 3.5, pkg_md_platinum: 3.25, pkg_dist_prime: 3.0, pkg_retailer_gold: 2.5},
  },
  {
    operatorCode: 'VI',
    operatorName: 'Vodafone Idea (Vi)',
    serviceType: 'MOBILE',
    rates: {pkg_admin_root: 4.0, pkg_md_platinum: 3.7, pkg_dist_prime: 3.45, pkg_retailer_gold: 3.1},
  },
  {
    operatorCode: 'BSNL',
    operatorName: 'BSNL Prepaid',
    serviceType: 'MOBILE',
    rates: {pkg_admin_root: 4.8, pkg_md_platinum: 4.5, pkg_dist_prime: 4.25, pkg_retailer_gold: 3.9},
  },
  {
    operatorCode: 'TATAPLAY',
    operatorName: 'Tata Play DTH',
    serviceType: 'DTH',
    rates: {pkg_admin_root: 3.8, pkg_md_platinum: 3.5, pkg_dist_prime: 3.25, pkg_retailer_gold: 2.9},
  },
  {
    operatorCode: 'AIRTELDTH',
    operatorName: 'Airtel Digital TV',
    serviceType: 'DTH',
    rates: {pkg_admin_root: 3.8, pkg_md_platinum: 3.5, pkg_dist_prime: 3.25, pkg_retailer_gold: 2.9},
  },
  {
    operatorCode: 'MSEB',
    operatorName: 'MSEDCL Electricity',
    serviceType: 'ELECTRICITY',
    rates: {pkg_admin_root: 0.75, pkg_md_platinum: 0.6, pkg_dist_prime: 0.45, pkg_retailer_gold: 0.25},
  },
  {
    operatorCode: 'FASTAG',
    operatorName: 'NHAI / Bank FASTag',
    serviceType: 'FASTAG',
    rates: {pkg_admin_root: 0.65, pkg_md_platinum: 0.5, pkg_dist_prime: 0.35, pkg_retailer_gold: 0.2},
  },
];

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as {toDate: () => Date}).toDate === 'function') {
    return (value as {toDate: () => Date}).toDate().toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return new Date().toISOString();
}

function clampString(input: unknown, fallback: string, minLen: number, maxLen: number): string {
  const cleaned = String(input ?? '').trim();
  const base = cleaned.length >= minLen ? cleaned : fallback;
  return base.slice(0, maxLen);
}

function sanitizePhone(raw: unknown, fallback = '0000000000'): string {
  const digits = String(raw ?? '').replace(/[^0-9+]/g, '');
  if (digits.length >= 10 && digits.length <= 15) return digits;
  if (digits.length > 15) return digits.slice(0, 15);
  return fallback;
}

function mapUserDoc(data: Record<string, unknown>, id: string): B2BUser {
  return {
    uid: String(data.uid || id),
    name: String(data.name || 'Partner'),
    shopName: String(data.shopName || 'Krishna Recharge Point'),
    phone: String(data.phone || '0000000000'),
    email: String(data.email || ''),
    role: (data.role as UserRole) || 'RETAILER',
    parentUid: String(data.parentUid || ''),
    parentShopName: String(data.parentShopName || ''),
    parentPhone: String(data.parentPhone || ''),
    packageId: String(data.packageId || 'pkg_retailer_gold'),
    walletBalance: Number(data.walletBalance ?? 0),
    tpin: String(data.tpin || '1234'),
    isActive: Boolean(data.isActive ?? true),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function mapPackageDoc(data: Record<string, unknown>, id: string): CommissionPackage {
  return {
    id: String(data.id || id),
    name: String(data.name || ''),
    roleTarget: (data.roleTarget as UserRole) || 'RETAILER',
    description: String(data.description || ''),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function mapSlabDoc(data: Record<string, unknown>, id: string): CommissionSlab {
  return {
    id: String(data.id || id),
    packageId: String(data.packageId || ''),
    operatorCode: String(data.operatorCode || ''),
    operatorName: String(data.operatorName || ''),
    serviceType: (data.serviceType as ServiceType) || 'MOBILE',
    commissionPercent: Number(data.commissionPercent ?? 0),
    updatedAt: tsToIso(data.updatedAt),
  };
}

function mapRechargeDoc(data: Record<string, unknown>, id: string): RechargeRecord {
  return {
    txnRef: String(data.txnRef || id),
    userUid: String(data.userUid || ''),
    userName: String(data.userName || ''),
    mobileNumber: String(data.mobileNumber || ''),
    operatorCode: String(data.operatorCode || ''),
    operatorName: String(data.operatorName || ''),
    serviceType: (data.serviceType as ServiceType) || 'MOBILE',
    amount: Number(data.amount ?? 0),
    retailerCommission: Number(data.retailerCommission ?? 0),
    netDebit: Number(data.netDebit ?? 0),
    status: (data.status as RechargeRecord['status']) || 'SUCCESS',
    apiTxnId: String(data.apiTxnId || ''),
    createdAt: tsToIso(data.createdAt),
  };
}

function mapLedgerDoc(data: Record<string, unknown>, id: string): LedgerEntry {
  return {
    id: String(data.id || id),
    userUid: String(data.userUid || ''),
    userName: String(data.userName || ''),
    actorUid: String(data.actorUid || ''),
    txnType: (data.txnType as 'CREDIT' | 'DEBIT') || 'DEBIT',
    amount: Number(data.amount ?? 0),
    openingBalance: Number(data.openingBalance ?? 0),
    closingBalance: Number(data.closingBalance ?? 0),
    referenceId: String(data.referenceId || ''),
    remark: String(data.remark || ''),
    createdAt: tsToIso(data.createdAt),
  };
}

function mapFundRequestDoc(data: Record<string, unknown>, id: string): FundRequest {
  return {
    id: String(data.id || id),
    requesterUid: String(data.requesterUid || ''),
    requesterName: String(data.requesterName || ''),
    requesterRole: (data.requesterRole as UserRole) || 'RETAILER',
    approverUid: String(data.approverUid || ''),
    approverName: String(data.approverName || 'Krishna Recharge HQ'),
    amount: Number(data.amount ?? 0),
    paymentMode: (data.paymentMode as PaymentMode) || 'UPI',
    utrNumber: String(data.utrNumber || ''),
    remark: String(data.remark || ''),
    status: (data.status as FundRequest['status']) || 'PENDING',
    actionRemark: String(data.actionRemark || ''),
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
  };
}

export async function ensureBootstrappedUserAndCatalog(firebaseUser: FirebaseUser): Promise<B2BUser> {
  if (!firebaseUser.emailVerified || !firebaseUser.email) {
    throw new Error('A verified Google email address is required to access Krishna Recharge.');
  }

  const uid = firebaseUser.uid;
  const email = firebaseUser.email;
  const isBootstrappedAdmin = email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  // 1. If bootstrapped admin, ensure admins/{uid}, packages, and slabs exist
  if (isBootstrappedAdmin) {
    const adminPath = `admins/${uid}`;
    try {
      const adminSnap = await getDoc(doc(db, 'admins', uid));
      if (!adminSnap.exists()) {
        await setDoc(doc(db, 'admins', uid), {
          email,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, adminPath);
    }

    try {
      const pkgSnaps = await getDocs(collection(db, 'packages'));
      const existingPkgIds = new Set(pkgSnaps.docs.map((d) => d.id));
      const missingPkgs = DEFAULT_PACKAGES.filter((p) => !existingPkgIds.has(p.id));
      if (missingPkgs.length > 0) {
        const pkgBatch = writeBatch(db);
        missingPkgs.forEach((pkg) => {
          pkgBatch.set(doc(db, 'packages', pkg.id), {
            ...pkg,
            updatedAt: serverTimestamp(),
          });
        });
        await pkgBatch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'packages');
    }

    try {
      const slabSnaps = await getDocs(collection(db, 'slabs'));
      const existingSlabIds = new Set(slabSnaps.docs.map((d) => d.id));
      const slabBatch = writeBatch(db);
      let pendingSlabs = 0;

      for (const pkg of DEFAULT_PACKAGES) {
        for (const op of OPERATOR_SEEDS) {
          const slabId = `slab_${pkg.id}_${op.operatorCode}`;
          if (!existingSlabIds.has(slabId)) {
            slabBatch.set(doc(db, 'slabs', slabId), {
              id: slabId,
              packageId: pkg.id,
              operatorCode: op.operatorCode,
              operatorName: op.operatorName,
              serviceType: op.serviceType,
              commissionPercent: op.rates[pkg.id] ?? 1.0,
              updatedAt: serverTimestamp(),
            });
            pendingSlabs++;
          }
        }
      }

      if (pendingSlabs > 0) {
        await slabBatch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'slabs');
    }
  }

  // 2. Ensure users/{uid} exists
  const userPath = `users/${uid}`;
  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      return mapUserDoc(userSnap.data(), userSnap.id);
    }

    const rawName = firebaseUser.displayName || email.split('@')[0] || 'Partner User';
    const safeName = clampString(rawName, 'Partner User', 2, 100);
    const safeShop = isBootstrappedAdmin
      ? 'Krishna Recharge Central'
      : clampString(`${safeName} Point`, 'Krishna Point', 2, 120);

    const newUserPayload = {
      uid,
      name: isBootstrappedAdmin ? clampString(rawName, 'Krishna HQ Admin', 2, 100) : safeName,
      shopName: safeShop,
      phone: isBootstrappedAdmin ? '9000000001' : sanitizePhone(firebaseUser.phoneNumber, '0000000000'),
      email: email.slice(0, 160),
      role: isBootstrappedAdmin ? ('ADMIN' as UserRole) : ('RETAILER' as UserRole),
      parentUid: '',
      parentShopName: '',
      parentPhone: '',
      packageId: isBootstrappedAdmin ? 'pkg_admin_root' : 'pkg_retailer_gold',
      walletBalance: isBootstrappedAdmin ? 500000 : 0,
      tpin: '1234',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', uid), newUserPayload);
    const createdSnap = await getDoc(doc(db, 'users', uid));
    if (createdSnap.exists()) {
      return mapUserDoc(createdSnap.data(), createdSnap.id);
    }
    return mapUserDoc(newUserPayload, uid);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export function subscribePortalData(
  currentUser: B2BUser,
  callbacks: {
    onUsers: (users: B2BUser[]) => void;
    onPackages: (packages: CommissionPackage[]) => void;
    onSlabs: (slabs: CommissionSlab[]) => void;
    onRecharges: (recharges: RechargeRecord[]) => void;
    onLedger: (ledger: LedgerEntry[]) => void;
    onFundRequests: (requests: FundRequest[]) => void;
    onError: (err: Error) => void;
  }
): Unsubscribe {
  const unsubs: Unsubscribe[] = [];
  const isBootstrappedAdmin = currentUser.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

  const wrapErr = (op: OperationType, path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, op, path);
    } catch (wrapped) {
      callbacks.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  // Packages
  unsubs.push(
    onSnapshot(
      collection(db, 'packages'),
      (snap) => {
        const list = snap.docs.map((d) => mapPackageDoc(d.data(), d.id));
        const order: Record<UserRole, number> = {ADMIN: 0, MD: 1, DISTRIBUTOR: 2, RETAILER: 3};
        list.sort((a, b) => (order[a.roleTarget] ?? 9) - (order[b.roleTarget] ?? 9));
        callbacks.onPackages(list);
      },
      wrapErr(OperationType.LIST, 'packages')
    )
  );

  // Slabs
  unsubs.push(
    onSnapshot(
      collection(db, 'slabs'),
      (snap) => {
        const list = snap.docs.map((d) => mapSlabDoc(d.data(), d.id));
        list.sort((a, b) => a.operatorName.localeCompare(b.operatorName));
        callbacks.onSlabs(list);
      },
      wrapErr(OperationType.LIST, 'slabs')
    )
  );

  // Users
  if (isBootstrappedAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const list = snap.docs.map((d) => mapUserDoc(d.data(), d.id));
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          callbacks.onUsers(list);
        },
        wrapErr(OperationType.LIST, 'users')
      )
    );
  } else {
    let selfUser: B2BUser | null = currentUser;
    let downlineUsers: B2BUser[] = [];
    const emitUsers = () => {
      const map = new Map<string, B2BUser>();
      if (selfUser) map.set(selfUser.uid, selfUser);
      downlineUsers.forEach((u) => map.set(u.uid, u));
      callbacks.onUsers(Array.from(map.values()));
    };

    unsubs.push(
      onSnapshot(
        doc(db, 'users', currentUser.uid),
        (snap) => {
          if (snap.exists()) {
            selfUser = mapUserDoc(snap.data(), snap.id);
            emitUsers();
          }
        },
        wrapErr(OperationType.GET, `users/${currentUser.uid}`)
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'users'), where('parentUid', '==', currentUser.uid)),
        (snap) => {
          downlineUsers = snap.docs.map((d) => mapUserDoc(d.data(), d.id));
          emitUsers();
        },
        wrapErr(OperationType.LIST, 'users')
      )
    );
  }

  // Recharges
  const rechargesRef = isBootstrappedAdmin
    ? collection(db, 'recharges')
    : query(collection(db, 'recharges'), where('userUid', '==', currentUser.uid));
  unsubs.push(
    onSnapshot(
      rechargesRef,
      (snap) => {
        const list = snap.docs.map((d) => mapRechargeDoc(d.data(), d.id));
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onRecharges(list);
      },
      wrapErr(OperationType.LIST, 'recharges')
    )
  );

  // Ledger
  const ledgerRef = isBootstrappedAdmin
    ? collection(db, 'ledger')
    : query(collection(db, 'ledger'), where('userUid', '==', currentUser.uid));
  unsubs.push(
    onSnapshot(
      ledgerRef,
      (snap) => {
        const list = snap.docs.map((d) => mapLedgerDoc(d.data(), d.id));
        list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onLedger(list);
      },
      wrapErr(OperationType.LIST, 'ledger')
    )
  );

  // Fund requests
  if (isBootstrappedAdmin) {
    unsubs.push(
      onSnapshot(
        collection(db, 'fund_requests'),
        (snap) => {
          const list = snap.docs.map((d) => mapFundRequestDoc(d.data(), d.id));
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          callbacks.onFundRequests(list);
        },
        wrapErr(OperationType.LIST, 'fund_requests')
      )
    );
  } else {
    let asRequester: FundRequest[] = [];
    let asApprover: FundRequest[] = [];
    const emitReqs = () => {
      const map = new Map<string, FundRequest>();
      asRequester.forEach((r) => map.set(r.id, r));
      asApprover.forEach((r) => map.set(r.id, r));
      const merged = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callbacks.onFundRequests(merged);
    };

    unsubs.push(
      onSnapshot(
        query(collection(db, 'fund_requests'), where('requesterUid', '==', currentUser.uid)),
        (snap) => {
          asRequester = snap.docs.map((d) => mapFundRequestDoc(d.data(), d.id));
          emitReqs();
        },
        wrapErr(OperationType.LIST, 'fund_requests')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'fund_requests'), where('approverUid', '==', currentUser.uid)),
        (snap) => {
          asApprover = snap.docs.map((d) => mapFundRequestDoc(d.data(), d.id));
          emitReqs();
        },
        wrapErr(OperationType.LIST, 'fund_requests')
      )
    );
  }

  return () => {
    unsubs.forEach((fn) => fn());
  };
}

export async function executeRecharge(params: {
  activeUser: B2BUser;
  slab: CommissionSlab;
  mobileNumber: string;
  amount: number;
  tpin: string;
}): Promise<RechargeRecord> {
  const {activeUser, slab, mobileNumber, amount, tpin} = params;
  const cleanSub = mobileNumber.trim().slice(0, 24);
  if (cleanSub.length < 6) throw new Error('Enter a valid subscriber number (min 6 characters).');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new Error('Recharge amount must be between ₹1 and ₹1,00,000.');
  }
  if (tpin.trim() !== activeUser.tpin) {
    throw new Error('Invalid Transaction PIN.');
  }

  const rate = slab.commissionPercent;
  const retailerCommission = +((amount * rate) / 100).toFixed(2);
  const netDebit = +(amount - retailerCommission).toFixed(2);
  if (netDebit <= 0) throw new Error('Net debit amount must be greater than zero.');

  const txnRef = `KR${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const ledgerId = `LDG${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const apiTxnId = `OP${Math.floor(100000 + Math.random() * 900000)}`;

  const userRef = doc(db, 'users', activeUser.uid);
  const rechargeRef = doc(db, 'recharges', txnRef);
  const ledgerRef = doc(db, 'ledger', ledgerId);

  try {
    await runTransaction(db, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists()) throw new Error('User profile not found.');

      const currentBal = Number(userSnap.data().walletBalance ?? 0);
      if (currentBal < netDebit) {
        throw new Error('Insufficient wallet balance.');
      }
      const closingBal = +(currentBal - netDebit).toFixed(2);

      transaction.update(userRef, {
        walletBalance: closingBal,
        updatedAt: serverTimestamp(),
      });

      transaction.set(rechargeRef, {
        txnRef,
        userUid: activeUser.uid,
        userName: clampString(activeUser.name, 'Partner', 2, 100),
        mobileNumber: cleanSub,
        operatorCode: slab.operatorCode.slice(0, 20),
        operatorName: slab.operatorName.slice(0, 60),
        serviceType: slab.serviceType,
        amount: +amount.toFixed(2),
        retailerCommission,
        netDebit,
        status: 'SUCCESS',
        apiTxnId,
        createdAt: serverTimestamp(),
      });

      transaction.set(ledgerRef, {
        id: ledgerId,
        userUid: activeUser.uid,
        userName: clampString(activeUser.name, 'Partner', 2, 100),
        actorUid: activeUser.uid,
        txnType: 'DEBIT',
        amount: netDebit,
        openingBalance: currentBal,
        closingBalance: closingBal,
        referenceId: txnRef,
        remark: clampString(`Recharge ${slab.operatorCode} ${cleanSub} (${txnRef})`, 'Recharge Debit', 2, 255),
        createdAt: serverTimestamp(),
      });
    });

    return {
      txnRef,
      userUid: activeUser.uid,
      userName: activeUser.name,
      mobileNumber: cleanSub,
      operatorCode: slab.operatorCode,
      operatorName: slab.operatorName,
      serviceType: slab.serviceType,
      amount: +amount.toFixed(2),
      retailerCommission,
      netDebit,
      status: 'SUCCESS',
      apiTxnId,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Insufficient wallet balance') || err.message.includes('User profile not found'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `recharges/${txnRef}`);
  }
}

export async function submitFundRequest(params: {
  activeUser: B2BUser;
  amount: number;
  paymentMode: PaymentMode;
  utrNumber: string;
  requestTo: 'PARENT' | 'ADMIN';
  remark: string;
}): Promise<string> {
  const {activeUser, amount, paymentMode, utrNumber, requestTo, remark} = params;
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new Error('Enter a valid amount between ₹1 and ₹10,00,000.');
  }

  const finalUtr =
    paymentMode === 'CASH'
      ? `CASH-${Date.now().toString().slice(-6)}-${activeUser.uid.slice(0, 6).toUpperCase()}`
      : utrNumber.trim().toUpperCase().slice(0, 100);

  if (finalUtr.length < 6) {
    throw new Error('Valid UTR / Reference number (minimum 6 characters) is required.');
  }

  const useParent = requestTo === 'PARENT' && Boolean(activeUser.parentUid);
  const approverUid = useParent ? activeUser.parentUid : '';
  const approverName = useParent
    ? clampString(activeUser.parentShopName, 'Upline Partner', 2, 100)
    : 'Krishna Recharge HQ';

  const requestId = `FRQ${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

  try {
    await setDoc(doc(db, 'fund_requests', requestId), {
      id: requestId,
      requesterUid: activeUser.uid,
      requesterName: clampString(activeUser.name, 'Partner', 2, 100),
      requesterRole: activeUser.role,
      approverUid,
      approverName,
      amount: +amount.toFixed(2),
      paymentMode,
      utrNumber: finalUtr,
      remark: remark.trim().slice(0, 255),
      status: 'PENDING',
      actionRemark: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return requestId;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `fund_requests/${requestId}`);
  }
}

export async function actOnFundRequest(params: {
  approver: B2BUser;
  fundRequest: FundRequest;
  action: 'APPROVE' | 'REJECT';
  tpin: string;
  actionRemark: string;
}): Promise<void> {
  const {approver, fundRequest, action, tpin, actionRemark} = params;

  if (action === 'APPROVE' && tpin.trim() !== approver.tpin) {
    throw new Error('Invalid Transaction PIN.');
  }

  const reqRef = doc(db, 'fund_requests', fundRequest.id);
  const requesterRef = doc(db, 'users', fundRequest.requesterUid);
  const approverRef = doc(db, 'users', approver.uid);

  const debitLedgerId = `LDGD${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const creditLedgerId = `LDGC${Date.now()}${Math.floor(100 + Math.random() * 900)}`;

  try {
    await runTransaction(db, async (transaction) => {
      const reqSnap = await transaction.get(reqRef);
      if (!reqSnap.exists()) throw new Error('Fund request not found.');
      if (reqSnap.data().status !== 'PENDING') {
        throw new Error(`Request is already ${String(reqSnap.data().status)}.`);
      }

      if (action === 'REJECT') {
        transaction.update(reqRef, {
          status: 'REJECTED',
          actionRemark: clampString(actionRemark, 'Payment not verified', 1, 255),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const requesterSnap = await transaction.get(requesterRef);
      if (!requesterSnap.exists()) throw new Error('Requester account not found.');

      let approverOpen = 0;
      if (approver.role !== 'ADMIN') {
        const approverSnap = await transaction.get(approverRef);
        if (!approverSnap.exists()) throw new Error('Approver account not found.');
        approverOpen = Number(approverSnap.data().walletBalance ?? 0);
        if (approverOpen < fundRequest.amount) {
          throw new Error('Insufficient wallet balance to approve this request.');
        }
      }

      const amt = +Number(fundRequest.amount).toFixed(2);
      const reqOpen = Number(requesterSnap.data().walletBalance ?? 0);
      const reqClose = +(reqOpen + amt).toFixed(2);
      const reqName = clampString(requesterSnap.data().name, fundRequest.requesterName, 2, 100);

      if (approver.role !== 'ADMIN') {
        const approverClose = +(approverOpen - amt).toFixed(2);
        transaction.update(approverRef, {
          walletBalance: approverClose,
          updatedAt: serverTimestamp(),
        });
        transaction.set(doc(db, 'ledger', debitLedgerId), {
          id: debitLedgerId,
          userUid: approver.uid,
          userName: clampString(approver.name, 'Approver', 2, 100),
          actorUid: approver.uid,
          txnType: 'DEBIT',
          amount: amt,
          openingBalance: approverOpen,
          closingBalance: approverClose,
          referenceId: fundRequest.id.slice(0, 64),
          remark: clampString(`Transfer to ${reqName} (${fundRequest.utrNumber})`, 'Fund Request Debit', 2, 255),
          createdAt: serverTimestamp(),
        });
      }

      transaction.update(requesterRef, {
        walletBalance: reqClose,
        updatedAt: serverTimestamp(),
      });

      transaction.set(doc(db, 'ledger', creditLedgerId), {
        id: creditLedgerId,
        userUid: fundRequest.requesterUid,
        userName: reqName,
        actorUid: approver.uid,
        txnType: 'CREDIT',
        amount: amt,
        openingBalance: reqOpen,
        closingBalance: reqClose,
        referenceId: fundRequest.id.slice(0, 64),
        remark: clampString(`Approved by ${approver.name} (${fundRequest.utrNumber})`, 'Fund Load Credit', 2, 255),
        createdAt: serverTimestamp(),
      });

      transaction.update(reqRef, {
        status: 'APPROVED',
        actionRemark: clampString(actionRemark, 'Approved', 1, 255),
        updatedAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes('Insufficient wallet') ||
        err.message.includes('already') ||
        err.message.includes('not found'))
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.UPDATE, `fund_requests/${fundRequest.id}`);
  }
}

export async function directWalletTransfer(params: {
  sender: B2BUser;
  receiver: B2BUser;
  amount: number;
  tpin: string;
  remark: string;
}): Promise<void> {
  const {sender, receiver, amount, tpin, remark} = params;
  if (sender.role === 'RETAILER') throw new Error('Retailers cannot transfer wallet funds.');
  if (sender.uid === receiver.uid) throw new Error('Cannot transfer to your own wallet.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new Error('Transfer amount must be between ₹1 and ₹10,00,000.');
  }
  if (tpin.trim() !== sender.tpin) {
    throw new Error('Invalid Transaction PIN.');
  }

  const refCode = `TRF${Date.now().toString().slice(-8)}`;
  const debitLedgerId = `LDGD${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const creditLedgerId = `LDGC${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const amt = +amount.toFixed(2);
  const cleanRemark = remark.trim() || 'Direct Wallet Load';

  const senderRef = doc(db, 'users', sender.uid);
  const receiverRef = doc(db, 'users', receiver.uid);

  try {
    await runTransaction(db, async (transaction) => {
      const receiverSnap = await transaction.get(receiverRef);
      if (!receiverSnap.exists()) throw new Error('Recipient account not found.');

      let senderOpen = 0;
      if (sender.role !== 'ADMIN') {
        const senderSnap = await transaction.get(senderRef);
        if (!senderSnap.exists()) throw new Error('Sender account not found.');
        senderOpen = Number(senderSnap.data().walletBalance ?? 0);
        if (senderOpen < amt) {
          throw new Error('Insufficient balance in your wallet.');
        }
        const senderClose = +(senderOpen - amt).toFixed(2);
        transaction.update(senderRef, {
          walletBalance: senderClose,
          updatedAt: serverTimestamp(),
        });
        transaction.set(doc(db, 'ledger', debitLedgerId), {
          id: debitLedgerId,
          userUid: sender.uid,
          userName: clampString(sender.name, 'Sender', 2, 100),
          actorUid: sender.uid,
          txnType: 'DEBIT',
          amount: amt,
          openingBalance: senderOpen,
          closingBalance: senderClose,
          referenceId: refCode,
          remark: clampString(`Transfer to ${receiver.name} - ${cleanRemark}`, 'Wallet Transfer', 2, 255),
          createdAt: serverTimestamp(),
        });
      }

      const recOpen = Number(receiverSnap.data().walletBalance ?? 0);
      const recClose = +(recOpen + amt).toFixed(2);
      transaction.update(receiverRef, {
        walletBalance: recClose,
        updatedAt: serverTimestamp(),
      });
      transaction.set(doc(db, 'ledger', creditLedgerId), {
        id: creditLedgerId,
        userUid: receiver.uid,
        userName: clampString(receiver.name, 'Receiver', 2, 100),
        actorUid: sender.uid,
        txnType: 'CREDIT',
        amount: amt,
        openingBalance: recOpen,
        closingBalance: recClose,
        referenceId: refCode,
        remark: clampString(`Received from ${sender.name} - ${cleanRemark}`, 'Wallet Credit', 2, 255),
        createdAt: serverTimestamp(),
      });
    });
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Insufficient balance') || err.message.includes('not found'))) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `users/${receiver.uid}`);
  }
}

export async function updateProfileAndTpin(params: {
  uid: string;
  name: string;
  shopName: string;
  phone: string;
  tpin: string;
}): Promise<void> {
  const cleanName = params.name.trim();
  const cleanShop = params.shopName.trim();
  const cleanPhone = params.phone.replace(/[^0-9+]/g, '');
  const cleanTpin = params.tpin.trim();

  if (cleanName.length < 2 || cleanName.length > 100) throw new Error('Name must be 2-100 characters.');
  if (cleanShop.length < 2 || cleanShop.length > 120) throw new Error('Shop name must be 2-120 characters.');
  if (cleanPhone.length < 10 || cleanPhone.length > 15) throw new Error('Phone must be 10-15 digits.');
  if (cleanTpin.length < 4 || cleanTpin.length > 6) throw new Error('T-PIN must be 4-6 characters.');

  try {
    await updateDoc(doc(db, 'users', params.uid), {
      name: cleanName,
      shopName: cleanShop,
      phone: cleanPhone,
      tpin: cleanTpin,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${params.uid}`);
  }
}

export async function createPartnerNode(params: {
  creator: B2BUser;
  name: string;
  shopName: string;
  phone: string;
  email: string;
  role: UserRole;
  packageId: string;
  customUid?: string;
}): Promise<void> {
  const {creator, name, shopName, phone, email, role, packageId, customUid} = params;
  if (creator.role === 'RETAILER') throw new Error('Retailers cannot onboard partner accounts.');

  const cleanName = name.trim();
  const cleanShop = shopName.trim();
  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  const cleanEmail = email.trim().toLowerCase();

  if (cleanName.length < 2 || cleanName.length > 100) throw new Error('Name must be 2-100 characters.');
  if (cleanShop.length < 2 || cleanShop.length > 120) throw new Error('Shop name must be 2-120 characters.');
  if (cleanPhone.length < 10 || cleanPhone.length > 15) throw new Error('Valid 10-15 digit phone number required.');
  if (cleanEmail.length < 5 || cleanEmail.length > 160 || !cleanEmail.includes('@')) {
    throw new Error('Valid partner email address required.');
  }

  const rawUid = (customUid || '').trim();
  const uid = rawUid && /^[a-zA-Z0-9_-]{2,128}$/.test(rawUid)
    ? rawUid
    : `partner_${cleanPhone.replace(/\D/g, '').slice(-10)}_${Date.now().toString().slice(-4)}`;

  try {
    await setDoc(doc(db, 'users', uid), {
      uid,
      name: cleanName,
      shopName: cleanShop,
      phone: cleanPhone,
      email: cleanEmail,
      role,
      parentUid: creator.uid,
      parentShopName: clampString(creator.shopName, creator.name, 2, 120),
      parentPhone: sanitizePhone(creator.phone, '9000000001'),
      packageId,
      walletBalance: 0,
      tpin: '1234',
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `users/${uid}`);
  }
}

export async function updatePartnerAssignment(params: {
  targetUid: string;
  role: UserRole;
  parentUser: B2BUser | null;
  packageId: string;
  isActive: boolean;
}): Promise<void> {
  const {targetUid, role, parentUser, packageId, isActive} = params;
  try {
    await updateDoc(doc(db, 'users', targetUid), {
      role,
      parentUid: parentUser ? parentUser.uid : '',
      parentShopName: parentUser ? clampString(parentUser.shopName, parentUser.name, 0, 120) : '',
      parentPhone: parentUser ? sanitizePhone(parentUser.phone, '') : '',
      packageId,
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${targetUid}`);
  }
}

export async function updateCommissionSlab(params: {
  slabId: string;
  commissionPercent: number;
}): Promise<void> {
  const pct = Number(params.commissionPercent);
  if (!Number.isFinite(pct) || pct < 0 || pct > 15) {
    throw new Error('Commission rate must be between 0% and 15%.');
  }

  try {
    await updateDoc(doc(db, 'slabs', params.slabId), {
      commissionPercent: +pct.toFixed(2),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `slabs/${params.slabId}`);
  }
}

export async function adminInstantWalletLoad(params: {
  adminUser: B2BUser;
  amount: number;
  gateway: 'UPI' | 'NET_BANKING';
  channelLabel: string;
  referenceCode: string;
}): Promise<string> {
  const {adminUser, amount, gateway, channelLabel, referenceCode} = params;
  if (adminUser.role !== 'ADMIN') {
    throw new Error('Only Admin HQ can directly credit the central settlement pool.');
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    throw new Error('Load amount must be between ₹1 and ₹10,00,000.');
  }

  const cleanRef = referenceCode.trim().toUpperCase().slice(0, 64);
  if (cleanRef.length < 4) {
    throw new Error('Valid payment reference (minimum 4 characters) is required.');
  }

  const amt = +amount.toFixed(2);
  const ledgerId = `LDGPG${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
  const adminRef = doc(db, 'users', adminUser.uid);
  const ledgerRef = doc(db, 'ledger', ledgerId);

  try {
    await runTransaction(db, async (transaction) => {
      const adminSnap = await transaction.get(adminRef);
      if (!adminSnap.exists()) throw new Error('Admin profile not found.');

      const openBal = Number(adminSnap.data().walletBalance ?? 0);
      const closeBal = +(openBal + amt).toFixed(2);

      transaction.update(adminRef, {
        walletBalance: closeBal,
        updatedAt: serverTimestamp(),
      });

      transaction.set(ledgerRef, {
        id: ledgerId,
        userUid: adminUser.uid,
        userName: clampString(adminUser.name, 'Krishna HQ Admin', 2, 100),
        actorUid: adminUser.uid,
        txnType: 'CREDIT',
        amount: amt,
        openingBalance: openBal,
        closingBalance: closeBal,
        referenceId: cleanRef,
        remark: clampString(
          `Instant ${gateway === 'UPI' ? 'UPI' : 'Net Banking'} Load (${channelLabel})`,
          'Gateway Pool Load',
          2,
          255
        ),
        createdAt: serverTimestamp(),
      });
    });
    return ledgerId;
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      throw err;
    }
    handleFirestoreError(err, OperationType.WRITE, `ledger/${ledgerId}`);
  }
}

