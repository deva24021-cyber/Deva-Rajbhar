import React, {useEffect, useMemo, useState} from 'react';
import {onAuthStateChanged, signInWithPopup, signOut, type User as FirebaseUser} from 'firebase/auth';
import {
  Check,
  Code2,
  Copy,
  CreditCard,
  FileDown,
  FileText,
  Layers,
  LogIn,
  LogOut,
  QrCode,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {BackendExportView} from './components/BackendExportView';
import {CommissionSlabsView} from './components/CommissionSlabsView';
import {NetworkUsersView} from './components/NetworkUsersView';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PassbookView} from './components/PassbookView';
import {PWAInstallButton} from './components/PWAInstallButton';
import {RechargeWorkspace} from './components/RechargeWorkspace';
import {StaticUpiQrModal} from './components/StaticUpiQrModal';
import {WalletFundView} from './components/WalletFundView';
import {auth, googleProvider} from './firebase';
import {
  ensureBootstrappedUserAndCatalog,
  subscribePortalData,
  updateProfileAndTpin,
} from './services/firestoreService';
import type {
  B2BUser,
  CommissionPackage,
  CommissionSlab,
  FundRequest,
  LedgerEntry,
  ProjectArtifact,
  RechargeRecord,
} from './types';
import {
  exportStatementCsv,
  exportStatementPdf,
  filterLedgerByMonth,
  getAvailableMonths,
} from './utils/statementExport';

type TabKey = 'recharge' | 'wallet' | 'passbook' | 'network' | 'slabs' | 'export';

const NAV_ITEMS: {key: TabKey; label: string; shortLabel: string; icon: React.ReactNode}[] = [
  {key: 'recharge', label: 'Recharge', shortLabel: 'Recharge', icon: <Zap className="h-4 w-4" />},
  {key: 'wallet', label: 'Wallet & Funds', shortLabel: 'Funds', icon: <Wallet className="h-4 w-4" />},
  {key: 'passbook', label: 'Passbook', shortLabel: 'Passbook', icon: <ReceiptText className="h-4 w-4" />},
  {key: 'network', label: 'Network', shortLabel: 'Network', icon: <Users className="h-4 w-4" />},
  {key: 'slabs', label: 'Slabs', shortLabel: 'Slabs', icon: <Layers className="h-4 w-4" />},
];

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bootstrappedUser, setBootstrappedUser] = useState<B2BUser | null>(null);
  const [users, setUsers] = useState<B2BUser[]>([]);
  const [packages, setPackages] = useState<CommissionPackage[]>([]);
  const [slabs, setSlabs] = useState<CommissionSlab[]>([]);
  const [recharges, setRecharges] = useState<RechargeRecord[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequest[]>([]);
  const [artifacts, setArtifacts] = useState<ProjectArtifact[]>([]);

  const [activeTab, setActiveTab] = useState<TabKey>('recharge');
  const [logoError, setLogoError] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Statement modal state
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementMonth, setStatementMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Static QR modal state
  const [showQrModal, setShowQrModal] = useState(false);

  // Profile & T-PIN settings modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profName, setProfName] = useState('');
  const [profShop, setProfShop] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profTpin, setProfTpin] = useState('');
  const [profSaving, setProfSaving] = useState(false);
  const [profError, setProfError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/artifacts')
      .then((res) => (res.ok ? res.json() : {artifacts: []}))
      .then((json: {artifacts?: ProjectArtifact[]}) => {
        if (json.artifacts) setArtifacts(json.artifacts);
      })
      .catch(() => {
        // Ignore artifact fetch failure offline
      });
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthReady(true);

      if (!fbUser) {
        setBootstrappedUser(null);
        setUsers([]);
        setPackages([]);
        setSlabs([]);
        setRecharges([]);
        setLedger([]);
        setFundRequests([]);
        setBootstrapping(false);
        return;
      }

      setBootstrapping(true);
      setError(null);
      try {
        const userDoc = await ensureBootstrappedUserAndCatalog(fbUser);
        setBootstrappedUser(userDoc);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize your cloud account.');
      } finally {
        setBootstrapping(false);
      }
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!bootstrappedUser) return;
    const unsubData = subscribePortalData(bootstrappedUser, {
      onUsers: setUsers,
      onPackages: setPackages,
      onSlabs: setSlabs,
      onRecharges: setRecharges,
      onLedger: setLedger,
      onFundRequests: setFundRequests,
      onError: (err) => setError(err.message),
    });
    return () => unsubData();
  }, [bootstrappedUser]);

  const activeUser = useMemo(() => {
    if (!bootstrappedUser) return null;
    return users.find((u) => u.uid === bootstrappedUser.uid) || bootstrappedUser;
  }, [bootstrappedUser, users]);

  const kpis = useMemo(() => {
    if (!activeUser) {
      return {volume: 0, commission: 0, pendingFunds: 0, downlineCount: 0};
    }

    const userRecharges =
      activeUser.role === 'ADMIN'
        ? recharges
        : recharges.filter((r) => r.userUid === activeUser.uid);

    const volume = userRecharges.reduce((sum, r) => sum + r.amount, 0);
    const commission = userRecharges.reduce((sum, r) => sum + r.retailerCommission, 0);

    const pendingFunds = fundRequests.filter(
      (fr) =>
        fr.status === 'PENDING' &&
        (activeUser.role === 'ADMIN' ||
          fr.approverUid === activeUser.uid ||
          fr.requesterUid === activeUser.uid)
    ).length;

    const downlineCount =
      activeUser.role === 'ADMIN'
        ? Math.max(0, users.length - 1)
        : users.filter((u) => u.parentUid === activeUser.uid).length;

    return {volume, commission, pendingFunds, downlineCount};
  }, [activeUser, recharges, fundRequests, users]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const copyPartnerUid = async () => {
    if (!activeUser) return;
    await navigator.clipboard.writeText(activeUser.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 1800);
  };

  const openProfileEditor = () => {
    if (!activeUser) return;
    setProfName(activeUser.name);
    setProfShop(activeUser.shopName);
    setProfPhone(activeUser.phone);
    setProfTpin(activeUser.tpin);
    setProfError(null);
    setShowProfileModal(true);
  };

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUser) return;
    setProfSaving(true);
    setProfError(null);
    try {
      await updateProfileAndTpin({
        uid: activeUser.uid,
        name: profName,
        shopName: profShop,
        phone: profPhone,
        tpin: profTpin,
      });
      setShowProfileModal(false);
    } catch (err) {
      setProfError(err instanceof Error ? err.message : 'Failed to save profile.');
    } finally {
      setProfSaving(false);
    }
  };

  if (!authReady || bootstrapping) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-200" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="border-b border-blue-950/30 bg-gradient-to-r from-[#0F296D] via-[#133B8C] to-[#0E5B6E] text-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
              {logoError ? (
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F6FF] text-blue-900 ring-1 ring-white/25 shrink-0">
                  <Wallet className="h-4 w-4" />
                </span>
              ) : (
                <img
                  src="/brand-logo.jpg"
                  alt="Krishna Recharge logo"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="h-8 w-8 rounded-lg object-cover bg-[#F1F6FF] ring-1 ring-white/25 shrink-0"
                />
              )}
              <span>Krishna Recharge</span>
            </div>
            <PWAInstallButton />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                <span>Verified Cloud B2B Portal</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Sign in to Krishna Recharge
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                Access your live wallet balance, Mobile/DTH/BBPS recharge terminal, static UPI QR, and monthly ledger statements backed by Cloud Firestore.
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={signingIn}
              onClick={handleGoogleSignIn}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#0F296D] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#133B8C] disabled:opacity-60 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>{signingIn ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
              <div>
                <div className="font-semibold text-slate-800">Atomic Ledger</div>
                <div>Every recharge &amp; load writes verified opening/closing balances.</div>
              </div>
              <div>
                <div className="font-semibold text-slate-800">Role-Isolated</div>
                <div>Admin, MD, Distributor &amp; Retailer permissions enforced by rules.</div>
              </div>
            </div>
          </div>
        </main>
        <OfflineIndicator />
      </div>
    );
  }

  if (error || !activeUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <h1 className="text-base font-semibold text-slate-900">Cloud Workspace Sync Notice</h1>
          <p className="text-xs text-red-700 break-words">{error || 'Unable to load your user profile.'}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 cursor-pointer"
            >
              Reload Portal
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* 3-Zone Top Bar Contract with Custom Brand Identity */}
      <header className="sticky top-0 z-30 border-b border-blue-950/30 bg-gradient-to-r from-[#0F296D] via-[#133B8C] to-[#0E5B6E] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
          {/* Zone 1: Brand logo icon + wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('recharge')}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            {logoError ? (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F1F6FF] text-blue-900 ring-1 ring-white/25 shrink-0">
                <Wallet className="h-4 w-4" />
              </span>
            ) : (
              <img
                src="/brand-logo.jpg"
                alt="Krishna Recharge logo"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
                className="h-8 w-8 rounded-lg object-cover bg-[#F1F6FF] ring-1 ring-white/25 shrink-0"
              />
            )}
            <span>Krishna Recharge</span>
          </button>

          {/* Zone 2: 5 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  activeTab === item.key
                    ? 'border-b-2 border-emerald-400 text-white font-semibold'
                    : 'text-blue-100/85 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <PWAInstallButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* Workspace Toolbar */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{activeUser.shopName}</span>
              <span aria-hidden="true">·</span>
              <span>{activeUser.role}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeUser.phone}</span>
              <span aria-hidden="true">·</span>
              <span>{activeUser.email}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={copyPartnerUid}
                className="inline-flex items-center gap-1 font-mono text-slate-600 hover:text-blue-800 cursor-pointer"
                title="Copy your Partner Firebase UID"
              >
                <span>UID: {activeUser.uid.slice(0, 8)}…</span>
                {copiedUid ? <Check className="h-3 w-3 text-emerald-700" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {activeTab === 'recharge' && 'Recharge & BBPS Workspace'}
              {activeTab === 'wallet' && 'Wallet Transfers & Fund Requests'}
              {activeTab === 'passbook' && 'Wallet Ledger & Passbook'}
              {activeTab === 'network' && 'B2B Hierarchy & User Onboarding'}
              {activeTab === 'slabs' && 'Commission Slabs & Profit Split'}
              {activeTab === 'export' && 'Backend API, MySQL Schema & GitHub Setup'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={openProfileEditor}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Profile &amp; T-PIN</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'export'
                  ? 'border-blue-800 bg-blue-50 text-blue-900 font-semibold'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Backend &amp; GitHub</span>
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </section>

        {/* Phone Setup Reminder for First-Time Google Sign-Ins */}
        {activeUser.phone === '0000000000' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-950">
            <span>
              Complete your partner profile by updating your 10-digit mobile number and setting a custom T-PIN (initial T-PIN is <span className="font-mono font-semibold">1234</span>).
            </span>
            <button
              type="button"
              onClick={openProfileEditor}
              className="rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-950 cursor-pointer"
            >
              Update Profile
            </button>
          </div>
        )}

        {/* 4-Column KPI Strip */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Wallet Balance</span>
                <CreditCard className="h-4 w-4 text-blue-800" />
              </div>
              <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
                ₹{activeUser.walletBalance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {activeUser.role === 'ADMIN' ? 'Central settlement pool' : 'Available float for instant txns'}
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const months = getAvailableMonths(ledger, activeUser);
                  if (months.length && !months.includes(statementMonth) && statementMonth !== 'ALL') {
                    setStatementMonth(months[0]);
                  }
                  setShowStatementModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 transition-colors hover:border-blue-800 hover:bg-blue-50 hover:text-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileDown className="h-3.5 w-3.5 text-blue-800" />
                <span>Download Statement</span>
              </button>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-1.5 text-xs font-semibold text-emerald-900 transition-colors hover:border-emerald-600 hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <QrCode className="h-3.5 w-3.5 text-emerald-700" />
                <span>Generate Static QR</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Recharge Volume</span>
              <Zap className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900">
              ₹{kpis.volume.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div className="mt-1 text-xs text-slate-500">Processed across Mobile, DTH &amp; BBPS</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>
                {activeUser.role === 'ADMIN' ? 'Partner Payouts' : 'Commission Earned'}
              </span>
              <Layers className="h-4 w-4 text-emerald-700" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-emerald-700">
              ₹{kpis.commission.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div className="mt-1 text-xs text-slate-500">Calculated automatically per slab</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Pending Fund Requests</span>
              <Wallet className="h-4 w-4 text-amber-600" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-slate-900">{kpis.pendingFunds}</div>
            <div className="mt-1 text-xs text-slate-500">
              {kpis.downlineCount} downline partners in tree
            </div>
          </div>
        </section>

        {/* Statement Export Modal */}
        {showStatementModal && (() => {
          const months = getAvailableMonths(ledger, activeUser);
          const filtered = filterLedgerByMonth(ledger, activeUser, statementMonth);
          const credits = filtered
            .filter((e) => e.txnType === 'CREDIT')
            .reduce((sum, e) => sum + e.amount, 0);
          const debits = filtered
            .filter((e) => e.txnType === 'DEBIT')
            .reduce((sum, e) => sum + e.amount, 0);

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="statement-modal-title"
            >
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="statement-modal-title" className="text-base font-semibold text-slate-900">
                      Download Monthly Ledger Statement
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {activeUser.name} · {activeUser.role} · {activeUser.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStatementModal(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                    aria-label="Close statement export"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div>
                  <label htmlFor="stmt-month" className="block text-xs font-medium text-slate-700">
                    Statement Period
                  </label>
                  <select
                    id="stmt-month"
                    value={statementMonth}
                    onChange={(e) => setStatementMonth(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
                  >
                    {months.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value="ALL">All Available Months</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <div>
                    <div className="text-slate-500">Entries</div>
                    <div className="mt-0.5 font-mono font-semibold text-slate-900">{filtered.length}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Credits</div>
                    <div className="mt-0.5 font-mono font-semibold text-emerald-700">
                      +₹{credits.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Debits</div>
                    <div className="mt-0.5 font-mono font-semibold text-red-700">
                      -₹{debits.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      exportStatementCsv(filtered, users, activeUser, statementMonth);
                      setShowStatementModal(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      exportStatementPdf(filtered, users, activeUser, statementMonth);
                      setShowStatementModal(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Static Merchant UPI QR Modal */}
        {showQrModal && (
          <StaticUpiQrModal
            activeUser={activeUser}
            onClose={() => setShowQrModal(false)}
            onOpenFundRequest={() => setActiveTab('wallet')}
          />
        )}

        {/* Profile & T-PIN Settings Modal */}
        {showProfileModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <form
              onSubmit={saveProfile}
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="profile-modal-title" className="text-base font-semibold text-slate-900">
                    Partner Profile &amp; T-PIN
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Initial default T-PIN is <span className="font-mono font-semibold">1234</span>. Update your counter details below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {profError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  {profError}
                </div>
              )}

              <div>
                <label htmlFor="prof-name" className="block text-xs font-medium text-slate-700">
                  Partner Name
                </label>
                <input
                  id="prof-name"
                  type="text"
                  maxLength={100}
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="prof-shop" className="block text-xs font-medium text-slate-700">
                  Shop / Business Name
                </label>
                <input
                  id="prof-shop"
                  type="text"
                  maxLength={120}
                  value={profShop}
                  onChange={(e) => setProfShop(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prof-phone" className="block text-xs font-medium text-slate-700">
                    Mobile Number
                  </label>
                  <input
                    id="prof-phone"
                    type="tel"
                    maxLength={15}
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="prof-tpin" className="block text-xs font-medium text-slate-700">
                    Transaction PIN (4-6 digits)
                  </label>
                  <input
                    id="prof-tpin"
                    type="password"
                    maxLength={6}
                    value={profTpin}
                    onChange={(e) => setProfTpin(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profSaving}
                  className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
                >
                  {profSaving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Active View Content */}
        <section>
          {activeTab === 'recharge' && (
            <RechargeWorkspace
              activeUser={activeUser}
              users={users}
              slabs={slabs}
              recharges={recharges}
            />
          )}
          {activeTab === 'wallet' && (
            <WalletFundView
              activeUser={activeUser}
              users={users}
              fundRequests={fundRequests}
            />
          )}
          {activeTab === 'passbook' && (
            <PassbookView activeUser={activeUser} users={users} ledger={ledger} />
          )}
          {activeTab === 'network' && (
            <NetworkUsersView
              activeUser={activeUser}
              users={users}
              packages={packages}
            />
          )}
          {activeTab === 'slabs' && (
            <CommissionSlabsView
              activeUser={activeUser}
              packages={packages}
              slabs={slabs}
            />
          )}
          {activeTab === 'export' && <BackendExportView artifacts={artifacts} />}
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white md:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActiveTab(item.key)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium cursor-pointer ${
              activeTab === item.key ? 'text-blue-800 font-semibold' : 'text-slate-500'
            }`}
          >
            {item.icon}
            <span className="truncate max-w-full">{item.shortLabel}</span>
          </button>
        ))}
      </nav>

      <OfflineIndicator />
    </div>
  );
}
