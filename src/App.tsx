import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  Code2,
  CreditCard,
  Layers,
  ReceiptText,
  RotateCcw,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import {BackendExportView} from './components/BackendExportView';
import {CommissionSlabsView} from './components/CommissionSlabsView';
import {NetworkUsersView} from './components/NetworkUsersView';
import {OfflineIndicator} from './components/OfflineIndicator';
import {PassbookView} from './components/PassbookView';
import {PWAInstallButton} from './components/PWAInstallButton';
import {RechargeWorkspace} from './components/RechargeWorkspace';
import {WalletFundView} from './components/WalletFundView';
import type {BootstrapPayload} from './types';

type TabKey = 'recharge' | 'wallet' | 'passbook' | 'network' | 'slabs' | 'export';

const NAV_ITEMS: {key: TabKey; label: string; shortLabel: string; icon: React.ReactNode}[] = [
  {key: 'recharge', label: 'Recharge', shortLabel: 'Recharge', icon: <Zap className="h-4 w-4" />},
  {key: 'wallet', label: 'Wallet & Funds', shortLabel: 'Funds', icon: <Wallet className="h-4 w-4" />},
  {key: 'passbook', label: 'Passbook', shortLabel: 'Passbook', icon: <ReceiptText className="h-4 w-4" />},
  {key: 'network', label: 'Network', shortLabel: 'Network', icon: <Users className="h-4 w-4" />},
  {key: 'slabs', label: 'Slabs', shortLabel: 'Slabs', icon: <Layers className="h-4 w-4" />},
];

export default function App() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('recharge');
  const [activeUserId, setActiveUserId] = useState<number>(4); // Default to Retailer Anil Kumar
  const [resetting, setResetting] = useState(false);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Failed to load Krishna Recharge workspace data.');
      const json = (await res.json()) as BootstrapPayload;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error loading portal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  const activeUser = useMemo(() => {
    if (!data?.users.length) return null;
    return data.users.find((u) => u.id === activeUserId) || data.users[0];
  }, [data, activeUserId]);

  const kpis = useMemo(() => {
    if (!data || !activeUser) {
      return {volume: 0, commission: 0, pendingFunds: 0, downlineCount: 0};
    }

    const userRecharges =
      activeUser.role === 'ADMIN'
        ? data.recharges
        : data.recharges.filter((r) => r.userId === activeUser.id);

    const volume = userRecharges.reduce((sum, r) => sum + r.amount, 0);

    let commission = 0;
    if (activeUser.role === 'RETAILER') {
      commission = userRecharges.reduce((sum, r) => sum + r.retailerCommission, 0);
    } else if (activeUser.role === 'ADMIN') {
      commission = data.recharges.reduce((sum, r) => sum + r.retailerCommission, 0);
    } else {
      commission = data.recharges.reduce((sum, r) => {
        const hit = r.uplineCredits.find((c) => c.userId === activeUser.id);
        return sum + (hit ? hit.amount : 0);
      }, 0);
    }

    const pendingFunds = data.fundRequests.filter(
      (fr) =>
        fr.status === 'PENDING' &&
        (activeUser.role === 'ADMIN' || fr.approverId === activeUser.id || fr.requesterId === activeUser.id)
    ).length;

    const downlineCount =
      activeUser.role === 'ADMIN'
        ? data.users.length - 1
        : data.users.filter((u) => u.parentId === activeUser.id).length;

    return {volume, commission, pendingFunds, downlineCount};
  }, [data, activeUser]);

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await fetch('/api/reset-demo', {method: 'POST'});
      await loadBootstrap();
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
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

  if (error || !data || !activeUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center space-y-3">
          <h1 className="text-base font-semibold text-slate-900">Unable to connect to Krishna Recharge API</h1>
          <p className="text-xs text-slate-600">{error || 'Workspace data unavailable.'}</p>
          <button
            type="button"
            onClick={loadBootstrap}
            className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          {/* Zone 1: Single text element wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('recharge')}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Krishna Recharge
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
                    ? 'border-b-2 border-blue-800 text-blue-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
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
        {/* Workspace Toolbar: Account Switcher, Unboxed Metadata, Export & Reset */}
        <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-900">{activeUser.shopName}</span>
              <span aria-hidden="true">·</span>
              <span>{activeUser.role}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{activeUser.phone}</span>
              <span aria-hidden="true">·</span>
              <span>Demo T-PIN: <span className="font-mono font-semibold text-slate-700">{activeUser.tpin}</span></span>
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
            <div className="flex items-center gap-2">
              <label htmlFor="role-switch" className="text-xs font-medium text-slate-500 whitespace-nowrap">
                Active Account
              </label>
              <select
                id="role-switch"
                value={activeUser.id}
                onChange={(e) => setActiveUserId(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                {data.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

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
              disabled={resetting}
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{resetting ? 'Resetting...' : 'Reset Demo'}</span>
            </button>
          </div>
        </section>

        {/* 4-Column KPI Strip */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
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
                {activeUser.role === 'RETAILER'
                  ? 'Commission Saved'
                  : activeUser.role === 'ADMIN'
                  ? 'Retailer Payouts'
                  : 'Upline Override Earned'}
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

        {/* Active View Content */}
        <section>
          {activeTab === 'recharge' && (
            <RechargeWorkspace
              activeUser={activeUser}
              users={data.users}
              slabs={data.slabs}
              recharges={data.recharges}
              onRefresh={loadBootstrap}
            />
          )}
          {activeTab === 'wallet' && (
            <WalletFundView
              activeUser={activeUser}
              users={data.users}
              fundRequests={data.fundRequests}
              onRefresh={loadBootstrap}
            />
          )}
          {activeTab === 'passbook' && (
            <PassbookView activeUser={activeUser} users={data.users} ledger={data.ledger} />
          )}
          {activeTab === 'network' && (
            <NetworkUsersView
              activeUser={activeUser}
              users={data.users}
              packages={data.packages}
              onRefresh={loadBootstrap}
            />
          )}
          {activeTab === 'slabs' && (
            <CommissionSlabsView
              activeUser={activeUser}
              packages={data.packages}
              slabs={data.slabs}
              onRefresh={loadBootstrap}
            />
          )}
          {activeTab === 'export' && <BackendExportView artifacts={data.artifacts} />}
        </section>
      </main>

      {/* Mobile Bottom Navigation Bar (<= 15% mobile height) */}
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
