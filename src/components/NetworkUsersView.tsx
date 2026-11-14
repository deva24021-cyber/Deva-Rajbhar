import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, UserPlus} from 'lucide-react';
import type {B2BUser, CommissionPackage, UserRole} from '../types';

interface NetworkUsersViewProps {
  activeUser: B2BUser;
  users: B2BUser[];
  packages: CommissionPackage[];
  onRefresh: () => Promise<void>;
}

export const NetworkUsersView: React.FC<NetworkUsersViewProps> = ({
  activeUser,
  users,
  packages,
  onRefresh,
}) => {
  const allowedRoles: UserRole[] = useMemo(() => {
    if (activeUser.role === 'ADMIN') return ['MD', 'DISTRIBUTOR', 'RETAILER'];
    if (activeUser.role === 'MD') return ['DISTRIBUTOR', 'RETAILER'];
    if (activeUser.role === 'DISTRIBUTOR') return ['RETAILER'];
    return [];
  }, [activeUser.role]);

  const [name, setName] = useState('');
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(allowedRoles[0] || 'RETAILER');
  const [packageId, setPackageId] = useState<number>(4);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);

  const visibleUsers = useMemo(() => {
    if (activeUser.role === 'ADMIN') return users;
    return users.filter((u) => u.id === activeUser.id || u.parentId === activeUser.id);
  }, [activeUser, users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const targetPkg = packages.find((p) => p.roleTarget === role)?.id || packageId;
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          creatorId: activeUser.id,
          name,
          shopName,
          phone,
          role,
          packageId: targetPkg,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to create user.');
      setName('');
      setShopName('');
      setPhone('');
      setFeedback({type: 'success', message: `${data.user.name} (${data.user.role}) onboarded with default T-PIN 1234.`});
      await onRefresh();
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Creation failed'});
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {allowedRoles.length > 0 && (
          <form
            onSubmit={handleCreateUser}
            className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-6 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-blue-800" />
              <h2 className="text-base font-semibold text-slate-900">Onboard Downline Member</h2>
            </div>
            <p className="text-xs text-slate-500">
              Create a new partner account under {activeUser.name} ({activeUser.role}).
            </p>

            <div>
              <label htmlFor="u-role" className="block text-xs font-medium text-slate-700">
                Account Tier
              </label>
              <select
                id="u-role"
                value={role}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setRole(nextRole);
                  const matched = packages.find((p) => p.roleTarget === nextRole);
                  if (matched) setPackageId(matched.id);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {r === 'MD' ? 'Master Distributor (MD)' : r === 'DISTRIBUTOR' ? 'Distributor' : 'Retailer'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="u-name" className="block text-xs font-medium text-slate-700">
                Full Name
              </label>
              <input
                id="u-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Suresh Gupta"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="u-shop" className="block text-xs font-medium text-slate-700">
                Shop / Business Name
              </label>
              <input
                id="u-shop"
                type="text"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Gupta Telecom Point"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="u-phone" className="block text-xs font-medium text-slate-700">
                Mobile Number
              </label>
              <input
                id="u-phone"
                type="tel"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="u-pkg" className="block text-xs font-medium text-slate-700">
                Commission Package
              </label>
              <select
                id="u-pkg"
                value={packageId}
                onChange={(e) => setPackageId(Number(e.target.value))}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-blue-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
            >
              {busy ? 'Creating...' : 'Create Partner Account'}
            </button>
          </form>
        )}

        <div className={`${allowedRoles.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} rounded-xl border border-slate-200 bg-white`}>
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">B2B Network Hierarchy</h2>
            <p className="text-xs text-slate-500">
              {visibleUsers.length} active partner accounts in your visibility tree
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Partner &amp; Shop</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Upline Parent</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 text-right font-medium">Wallet Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((u) => {
                  const parentName = users.find((p) => p.id === u.parentId)?.name || 'Root';
                  const pkgName = packages.find((p) => p.id === u.packageId)?.name || 'Standard';
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-[11px] text-slate-500">{u.shopName}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">{u.phone}</td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{u.role}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{parentName}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{pkgName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        ₹{u.walletBalance.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
