import React, {useMemo, useState} from 'react';
import {AlertCircle, Car, CheckCircle2, Clock, Lock, Smartphone, Tv, X, Zap} from 'lucide-react';
import {executeRecharge} from '../services/firestoreService';
import type {B2BUser, CommissionSlab, RechargeRecord, ServiceType} from '../types';

interface RechargeWorkspaceProps {
  activeUser: B2BUser;
  users: B2BUser[];
  slabs: CommissionSlab[];
  recharges: RechargeRecord[];
}

const QUICK_PLANS: Record<ServiceType, number[]> = {
  MOBILE: [239, 299, 666, 719, 999, 2999],
  DTH: [250, 350, 500, 1000, 1800],
  ELECTRICITY: [500, 1200, 2500, 5000],
  FASTAG: [500, 1000, 2000, 3000],
};

const SERVICE_LABELS: {id: ServiceType; label: string; icon: React.ReactNode}[] = [
  {id: 'MOBILE', label: 'Prepaid Mobile', icon: <Smartphone className="h-4 w-4" />},
  {id: 'DTH', label: 'DTH TV', icon: <Tv className="h-4 w-4" />},
  {id: 'ELECTRICITY', label: 'Electricity', icon: <Zap className="h-4 w-4" />},
  {id: 'FASTAG', label: 'FASTag', icon: <Car className="h-4 w-4" />},
];

export const RechargeWorkspace: React.FC<RechargeWorkspaceProps> = ({
  activeUser,
  users,
  slabs,
  recharges,
}) => {
  const [serviceType, setServiceType] = useState<ServiceType>('MOBILE');
  const [selectedOp, setSelectedOp] = useState<string>('AIRTEL');
  const [subscriberId, setSubscriberId] = useState('');
  const [amountInput, setAmountInput] = useState('299');
  const [showTpinModal, setShowTpinModal] = useState(false);
  const [tpin, setTpin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);

  const userSlabs = useMemo(
    () => slabs.filter((s) => s.packageId === activeUser.packageId && s.serviceType === serviceType),
    [slabs, activeUser.packageId, serviceType]
  );

  const activeSlab = useMemo(
    () => userSlabs.find((s) => s.operatorCode === selectedOp) || userSlabs[0],
    [userSlabs, selectedOp]
  );

  const handleServiceChange = (next: ServiceType) => {
    setServiceType(next);
    const firstOp = slabs.find((s) => s.packageId === activeUser.packageId && s.serviceType === next);
    if (firstOp) setSelectedOp(firstOp.operatorCode);
    setAmountInput(String(QUICK_PLANS[next][0]));
  };

  const amountNum = Number(amountInput) || 0;
  const rate = activeSlab?.commissionPercent ?? 0;
  const commission = +((amountNum * rate) / 100).toFixed(2);
  const netDebit = +(amountNum - commission).toFixed(2);

  const openConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!activeUser.isActive) {
      setFeedback({type: 'error', message: 'Your partner account is currently suspended. Contact your upline.'});
      return;
    }
    if (!activeSlab) {
      setFeedback({type: 'error', message: 'Operator slab rates are not initialized yet. Contact Admin HQ.'});
      return;
    }
    if (subscriberId.trim().length < 6 || amountNum <= 0) {
      setFeedback({type: 'error', message: 'Enter a valid subscriber number (min 6 digits) and positive amount.'});
      return;
    }
    if (netDebit > activeUser.walletBalance) {
      setFeedback({type: 'error', message: 'Insufficient wallet balance. Submit a fund request or load wallet first.'});
      return;
    }
    setTpin('');
    setShowTpinModal(true);
  };

  const submitRecharge = async () => {
    if (!activeSlab) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const record = await executeRecharge({
        activeUser,
        slab: activeSlab,
        mobileNumber: subscriberId.trim(),
        amount: amountNum,
        tpin,
      });
      setShowTpinModal(false);
      setSubscriberId('');
      setFeedback({
        type: 'success',
        message: `Recharge ${record.txnRef} succeeded for ${record.mobileNumber}. Net debit ₹${record.netDebit.toFixed(2)} (saved ₹${record.retailerCommission.toFixed(2)}).`,
      });
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Recharge failed'});
    } finally {
      setSubmitting(false);
    }
  };

  const visibleRecharges = useMemo(() => {
    if (activeUser.role === 'ADMIN') return recharges;
    return recharges.filter((r) => r.userUid === activeUser.uid);
  }, [activeUser, recharges]);

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-500 hover:text-slate-800 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          onSubmit={openConfirm}
          className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-6 space-y-5"
        >
          <div>
            <h2 className="text-base font-semibold text-slate-900">Instant Recharge &amp; BBPS Terminal</h2>
            <p className="mt-1 text-xs text-slate-500">
              Select service, operator slab, and authorize with your T-PIN for atomic wallet settlement.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-slate-100 p-1 sm:grid-cols-4">
            {SERVICE_LABELS.map((svc) => (
              <button
                key={svc.id}
                type="button"
                onClick={() => handleServiceChange(svc.id)}
                className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  serviceType === svc.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {svc.icon}
                <span>{svc.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Operator &amp; Your Slab Rate</label>
            {userSlabs.length === 0 ? (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
                Operator slabs are awaiting initialization by Admin HQ.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {userSlabs.map((slab) => {
                  const selected = activeSlab?.operatorCode === slab.operatorCode;
                  return (
                    <button
                      key={slab.id}
                      type="button"
                      onClick={() => setSelectedOp(slab.operatorCode)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-xs transition-colors cursor-pointer ${
                        selected
                          ? 'border-blue-800 bg-blue-50/70 text-blue-950 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="truncate">{slab.operatorName}</span>
                      <span className="font-mono text-[11px] font-semibold text-emerald-700 shrink-0 ml-2">
                        {slab.commissionPercent.toFixed(2)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sub-id" className="block text-xs font-medium text-slate-700">
                {serviceType === 'MOBILE'
                  ? '10-Digit Mobile Number'
                  : serviceType === 'DTH'
                  ? 'DTH Subscriber ID'
                  : serviceType === 'ELECTRICITY'
                  ? 'Consumer Number'
                  : 'Vehicle Reg. Number'}
              </label>
              <input
                id="sub-id"
                type="text"
                maxLength={24}
                value={subscriberId}
                onChange={(e) => setSubscriberId(e.target.value)}
                placeholder={serviceType === 'MOBILE' ? '9876543210' : 'Enter ID'}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                required
              />
            </div>

            <div>
              <label htmlFor="recharge-amt" className="block text-xs font-medium text-slate-700">
                Amount (INR)
              </label>
              <input
                id="recharge-amt"
                type="number"
                min="1"
                max="100000"
                step="1"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500">Quick Denomination</span>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {QUICK_PLANS[serviceType].map((plan) => (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setAmountInput(String(plan))}
                  className={`rounded-md border px-2.5 py-1 font-mono text-xs transition-colors cursor-pointer ${
                    Number(amountInput) === plan
                      ? 'border-blue-800 bg-blue-800 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  ₹{plan}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-2 text-xs">
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Gross Recharge Amount</span>
              <span className="font-mono font-semibold text-slate-900">₹{amountNum.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-slate-600">Your Instant Margin ({rate.toFixed(2)}%)</span>
              <span className="font-mono font-semibold text-emerald-700">- ₹{commission.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="font-semibold text-slate-900">Net Wallet Deduction</span>
              <span className="font-mono text-sm font-bold text-blue-900">₹{netDebit.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!activeSlab}
            className="w-full rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-900 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800 cursor-pointer"
          >
            Proceed to Recharge
          </button>
        </form>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent Recharge Transactions</h2>
              <p className="text-xs text-slate-500">
                Showing {visibleRecharges.length} live cloud transactions
              </p>
            </div>
          </div>

          {visibleRecharges.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No recharge transactions recorded yet. Submit a recharge from the terminal to log a real-time entry.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Txn Ref</th>
                    <th className="px-4 py-3 font-medium">Subscriber</th>
                    <th className="px-4 py-3 font-medium">Operator</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                    <th className="px-4 py-3 text-right font-medium">Net Debit</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRecharges.slice(0, 15).map((r) => {
                    const userName = users.find((u) => u.uid === r.userUid)?.name || r.userName;
                    return (
                      <tr key={r.txnRef} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                          <div>{r.txnRef}</div>
                          <div className="text-[11px] font-sans text-slate-400">{userName}</div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-900 whitespace-nowrap">{r.mobileNumber}</td>
                        <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">{r.operatorName}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-medium text-slate-900 whitespace-nowrap">
                          ₹{r.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-emerald-700 whitespace-nowrap">
                          ₹{r.retailerCommission.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          ₹{r.netDebit.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                            {r.status === 'SUCCESS' ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-amber-600" />
                            )}
                            <span>{r.status}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showTpinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpin-dialog-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-slate-900">
              <Lock className="h-4 w-4 text-blue-800" />
              <h3 id="tpin-dialog-title" className="text-base font-semibold">
                Authorize Transaction
              </h3>
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              Confirm {activeSlab?.operatorName} recharge for{' '}
              <span className="font-mono font-semibold text-slate-800">{subscriberId}</span>. Net wallet deduction:{' '}
              <span className="font-mono font-semibold text-slate-900">₹{netDebit.toFixed(2)}</span>.
            </p>

            <div className="mt-4">
              <label htmlFor="tpin-input" className="block text-xs font-medium text-slate-700">
                Transaction PIN
              </label>
              <input
                id="tpin-input"
                type="password"
                maxLength={6}
                autoFocus
                value={tpin}
                onChange={(e) => setTpin(e.target.value)}
                placeholder="Enter 4-6 digit T-PIN"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest focus:border-blue-800 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowTpinModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitRecharge}
                className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Processing...' : 'Confirm & Pay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
