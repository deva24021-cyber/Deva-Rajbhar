import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, Edit3, UserPlus, X} from 'lucide-react';
import {createPartnerNode, updatePartnerAssignment} from '../services/firestoreService';
import type {B2BUser, CommissionPackage, UserRole} from '../types';

interface NetworkUsersViewProps {
  activeUser: B2BUser;
  users: B2BUser[];
  packages: CommissionPackage[];
}

export const NetworkUsersView: React.FC<NetworkUsersViewProps> = ({
  activeUser,
  users,
  packages,
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
  const [email, setEmail] = useState('');
  const [customUid, setCustomUid] = useState('');
  const [role, setRole] = useState<UserRole>(allowedRoles[0] || 'RETAILER');
  const [packageId, setPackageId] = useState<string>('pkg_retailer_gold');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);

  const [editingUser, setEditingUser] = useState<B2BUser | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('RETAILER');
  const [editParentUid, setEditParentUid] = useState<string>('');
  const [editPackageId, setEditPackageId] = useState<string>('pkg_retailer_gold');
  const [editActive, setEditActive] = useState<boolean>(true);

  const visibleUsers = useMemo(() => {
    if (activeUser.role === 'ADMIN') return users;
    return users.filter((u) => u.uid === activeUser.uid || u.parentUid === activeUser.uid);
  }, [activeUser, users]);

  const potentialParents = useMemo(
    () => users.filter((u) => u.role === 'ADMIN' || u.role === 'MD' || u.role === 'DISTRIBUTOR'),
    [users]
  );

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const targetPkg = packages.find((p) => p.roleTarget === role)?.id || packageId;
      await createPartnerNode({
        creator: activeUser,
        name,
        shopName,
        phone,
        email,
        role,
        packageId: targetPkg,
        customUid,
      });
      setName('');
      setShopName('');
      setPhone('');
      setEmail('');
      setCustomUid('');
      setFeedback({type: 'success', message: `${name.trim()} (${role}) onboarded to Firestore network.`});
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Creation failed'});
    } finally {
      setBusy(false);
    }
  };

  const openEditModal = (u: B2BUser) => {
    setEditingUser(u);
    setEditRole(u.role);
    setEditParentUid(u.parentUid);
    setEditPackageId(u.packageId);
    setEditActive(u.isActive);
  };

  const saveEditAssignment = async () => {
    if (!editingUser) return;
    setBusy(true);
    setFeedback(null);
    try {
      const parentObj = users.find((p) => p.uid === editParentUid) || null;
      await updatePartnerAssignment({
        targetUid: editingUser.uid,
        role: editRole,
        parentUser: parentObj,
        packageId: editPackageId,
        isActive: editActive,
      });
      setFeedback({type: 'success', message: `Updated tier and hierarchy assignment for ${editingUser.name}.`});
      setEditingUser(null);
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Update failed'});
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
              Register a partner node under {activeUser.name} ({activeUser.role}). Provide their Google Auth UID if already signed in.
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
                maxLength={100}
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
                maxLength={120}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="e.g. Gupta Telecom Point"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-800 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="u-phone" className="block text-xs font-medium text-slate-700">
                  Mobile Number
                </label>
                <input
                  id="u-phone"
                  type="tel"
                  maxLength={15}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-800 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label htmlFor="u-email" className="block text-xs font-medium text-slate-700">
                  Google Email
                </label>
                <input
                  id="u-email"
                  type="email"
                  maxLength={160}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@gmail.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-800 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="u-uid" className="block text-xs font-medium text-slate-700">
                Firebase UID (Optional)
              </label>
              <input
                id="u-uid"
                type="text"
                maxLength={128}
                value={customUid}
                onChange={(e) => setCustomUid(e.target.value)}
                placeholder="Paste partner Google UID if known"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-blue-800 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="u-pkg" className="block text-xs font-medium text-slate-700">
                Commission Package
              </label>
              <select
                id="u-pkg"
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
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
              {visibleUsers.length} partner accounts in your visibility tree
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Partner &amp; Shop</th>
                  <th className="px-4 py-3 font-medium">Mobile / Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Upline Parent</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 text-right font-medium">Wallet Balance</th>
                  {activeUser.role === 'ADMIN' && <th className="px-4 py-3 text-right font-medium">Manage</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleUsers.map((u) => {
                  const parentName =
                    users.find((p) => p.uid === u.parentUid)?.name || u.parentShopName || 'Root HQ';
                  const pkgName = packages.find((p) => p.id === u.packageId)?.name || u.packageId;
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {u.name}
                          {!u.isActive && <span className="ml-1.5 text-[11px] text-red-600">(Suspended)</span>}
                        </div>
                        <div className="text-[11px] text-slate-500">{u.shopName}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono text-slate-800">{u.phone}</div>
                        <div className="text-[11px] text-slate-400">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">{u.role}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{parentName}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{pkgName}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                        ₹{u.walletBalance.toFixed(2)}
                      </td>
                      {activeUser.role === 'ADMIN' && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {u.uid !== activeUser.uid ? (
                            <button
                              type="button"
                              onClick={() => openEditModal(u)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">You</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Manage Partner Assignment</h3>
                <p className="text-xs text-slate-500">
                  {editingUser.name} ({editingUser.email})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Role Tier</label>
              <select
                value={editRole}
                onChange={(e) => {
                  const r = e.target.value as UserRole;
                  setEditRole(r);
                  const matched = packages.find((p) => p.roleTarget === r);
                  if (matched) setEditPackageId(matched.id);
                }}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="MD">Master Distributor (MD)</option>
                <option value="DISTRIBUTOR">Distributor</option>
                <option value="RETAILER">Retailer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Upline Parent</label>
              <select
                value={editParentUid}
                onChange={(e) => setEditParentUid(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                <option value="">Direct to Admin HQ</option>
                {potentialParents
                  .filter((p) => p.uid !== editingUser.uid)
                  .map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.name} ({p.role} · {p.shopName})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">Commission Package</label>
              <select
                value={editPackageId}
                onChange={(e) => setEditPackageId(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Account Active (can execute transactions)</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveEditAssignment}
                className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
