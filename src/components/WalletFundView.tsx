import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, Send, XCircle} from 'lucide-react';
import type {B2BUser, FundRequest, PaymentMode} from '../types';

interface WalletFundViewProps {
  activeUser: B2BUser;
  users: B2BUser[];
  fundRequests: FundRequest[];
  onRefresh: () => Promise<void>;
}

export const WalletFundView: React.FC<WalletFundViewProps> = ({
  activeUser,
  users,
  fundRequests,
  onRefresh,
}) => {
  // Fund Request Form (Pull)
  const [reqAmount, setReqAmount] = useState('5000');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [requestTo, setRequestTo] = useState<'PARENT' | 'ADMIN'>('PARENT');
  const [reqRemark, setReqRemark] = useState('');

  // Direct Transfer Form (Push)
  const downlineUsers = useMemo(() => {
    if (activeUser.role === 'ADMIN') return users.filter((u) => u.id !== activeUser.id);
    return users.filter((u) => u.parentId === activeUser.id);
  }, [activeUser, users]);

  const [receiverId, setReceiverId] = useState<number>(downlineUsers[0]?.id ?? 0);
  const [transferAmount, setTransferAmount] = useState('2000');
  const [transferTpin, setTransferTpin] = useState('');
  const [transferRemark, setTransferRemark] = useState('');

  // Action modal state for approving/rejecting requests
  const [actionTarget, setActionTarget] = useState<{req: FundRequest; mode: 'APPROVE' | 'REJECT'} | null>(null);
  const [actionTpin, setActionTpin] = useState('');
  const [actionRemark, setActionRemark] = useState('');

  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const visibleRequests = useMemo(() => {
    if (activeUser.role === 'ADMIN') return fundRequests;
    return fundRequests.filter(
      (fr) => fr.requesterId === activeUser.id || fr.approverId === activeUser.id
    );
  }, [activeUser, fundRequests]);

  const submitFundRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallet/fund-request', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          requesterId: activeUser.id,
          amount: Number(reqAmount),
          paymentMode,
          utrNumber,
          requestTo,
          remark: reqRemark,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to submit fund request.');
      setUtrNumber('');
      setReqRemark('');
      setFeedback({type: 'success', message: 'Fund request submitted and queued for approver verification.'});
      await onRefresh();
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Request failed'});
    } finally {
      setBusy(false);
    }
  };

  const submitDirectTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const targetId = receiverId || downlineUsers[0]?.id;
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          senderId: activeUser.id,
          receiverId: targetId,
          amount: Number(transferAmount),
          tpin: transferTpin,
          remark: transferRemark || 'Direct Wallet Load',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Transfer failed.');
      setTransferTpin('');
      setTransferRemark('');
      setFeedback({type: 'success', message: data.message});
      await onRefresh();
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Transfer failed'});
    } finally {
      setBusy(false);
    }
  };

  const handleRequestAction = async () => {
    if (!actionTarget) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/wallet/fund-request/action', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          approverId: activeUser.id,
          requestId: actionTarget.req.id,
          action: actionTarget.mode,
          tpin: actionTpin,
          actionRemark,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Action failed.');
      setActionTarget(null);
      setActionTpin('');
      setActionRemark('');
      setFeedback({type: 'success', message: data.message});
      await onRefresh();
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Action failed'});
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
        {/* Left: Request Fund & Direct Transfer */}
        <div className="lg:col-span-5 space-y-6">
          {activeUser.role !== 'ADMIN' && (
            <form
              onSubmit={submitFundRequest}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Submit Fund Request</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Deposit funds via UPI/IMPS/NEFT and submit a unique UTR for upline or Admin approval.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Request To</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    {(['PARENT', 'ADMIN'] as const).map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => setRequestTo(target)}
                        className={`rounded-md py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          requestTo === target ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {target === 'PARENT' ? 'Upline' : 'Admin HQ'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="pay-mode" className="block text-xs font-medium text-slate-700">
                    Payment Mode
                  </label>
                  <select
                    id="pay-mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
                  >
                    <option value="UPI">UPI</option>
                    <option value="IMPS">IMPS</option>
                    <option value="NEFT">NEFT</option>
                    <option value="CASH">Cash Deposit</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="req-amt" className="block text-xs font-medium text-slate-700">
                    Amount (INR)
                  </label>
                  <input
                    id="req-amt"
                    type="number"
                    min="1"
                    value={reqAmount}
                    onChange={(e) => setReqAmount(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>

                {paymentMode !== 'CASH' && (
                  <div>
                    <label htmlFor="req-utr" className="block text-xs font-medium text-slate-700">
                      UTR / Reference No.
                    </label>
                    <input
                      id="req-utr"
                      type="text"
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="e.g. UPI431982099"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-blue-800 focus:outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="req-remark" className="block text-xs font-medium text-slate-700">
                  Remark (Optional)
                </label>
                <input
                  id="req-remark"
                  type="text"
                  value={reqRemark}
                  onChange={(e) => setReqRemark(e.target.value)}
                  placeholder="Bank / UPI sender note"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-900 disabled:opacity-50 cursor-pointer"
              >
                Submit Fund Request
              </button>
            </form>
          )}

          {activeUser.role !== 'RETAILER' && (
            <form
              onSubmit={submitDirectTransfer}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Direct Downline Wallet Transfer</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Push balance immediately to a direct downline member using deadlock-safe atomic transfer.
                </p>
              </div>

              <div>
                <label htmlFor="trf-receiver" className="block text-xs font-medium text-slate-700">
                  Recipient Account
                </label>
                <select
                  id="trf-receiver"
                  value={receiverId || downlineUsers[0]?.id || ''}
                  onChange={(e) => setReceiverId(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
                >
                  {downlineUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role} · Bal ₹{u.walletBalance.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="trf-amt" className="block text-xs font-medium text-slate-700">
                    Amount (INR)
                  </label>
                  <input
                    id="trf-amt"
                    type="number"
                    min="1"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="trf-pin" className="block text-xs font-medium text-slate-700">
                    Your T-PIN (1234)
                  </label>
                  <input
                    id="trf-pin"
                    type="password"
                    value={transferTpin}
                    onChange={(e) => setTransferTpin(e.target.value)}
                    placeholder="1234"
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="trf-remark" className="block text-xs font-medium text-slate-700">
                  Transfer Note
                </label>
                <input
                  id="trf-remark"
                  type="text"
                  value={transferRemark}
                  onChange={(e) => setTransferRemark(e.target.value)}
                  placeholder="Evening settlement load"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-blue-800 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busy || downlineUsers.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Transfer Funds</span>
              </button>
            </form>
          )}
        </div>

        {/* Right: Fund Requests Queue */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Fund Request Queue &amp; Approvals</h2>
            <p className="text-xs text-slate-500">
              Pending requests awaiting approval and historical UTR settlements
            </p>
          </div>

          {visibleRequests.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No fund requests in your queue.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Requester</th>
                    <th className="px-4 py-3 font-medium">Mode / UTR</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Approver</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleRequests.map((fr) => {
                    const reqUser = users.find((u) => u.id === fr.requesterId);
                    const appUser = users.find((u) => u.id === fr.approverId);
                    const canAct =
                      fr.status === 'PENDING' &&
                      (fr.approverId === activeUser.id || activeUser.role === 'ADMIN');

                    return (
                      <tr key={fr.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{reqUser?.name || 'User'}</div>
                          <div className="text-[11px] text-slate-500">{reqUser?.role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-medium text-slate-800">{fr.utrNumber}</div>
                          <div className="text-[11px] text-slate-500">
                            {fr.paymentMode}
                            {fr.remark ? ` · ${fr.remark}` : ''}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                          ₹{fr.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {appUser?.name || 'Admin'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {fr.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approved
                            </span>
                          )}
                          {fr.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <Clock className="h-3.5 w-3.5" />
                              Pending
                            </span>
                          )}
                          {fr.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700">
                              <XCircle className="h-3.5 w-3.5" />
                              Rejected
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {canAct ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActionTpin('');
                                  setActionRemark('');
                                  setActionTarget({req: fr, mode: 'APPROVE'});
                                }}
                                className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActionTpin('');
                                  setActionRemark('');
                                  setActionTarget({req: fr, mode: 'REJECT'});
                                }}
                                className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {fr.actionRemark || '—'}
                            </span>
                          )}
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

      {/* Approve / Reject Modal */}
      {actionTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">
              {actionTarget.mode === 'APPROVE' ? 'Approve Fund Request' : 'Reject Fund Request'}
            </h3>
            <p className="text-xs text-slate-600">
              Request #{actionTarget.req.id} · UTR{' '}
              <span className="font-mono font-semibold">{actionTarget.req.utrNumber}</span> · Amount{' '}
              <span className="font-mono font-semibold">₹{actionTarget.req.amount.toFixed(2)}</span>
            </p>

            {actionTarget.mode === 'APPROVE' && (
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Approver T-PIN (Demo: 1234)
                </label>
                <input
                  type="password"
                  value={actionTpin}
                  onChange={(e) => setActionTpin(e.target.value)}
                  placeholder="Enter T-PIN"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-blue-800 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700">Action Remark</label>
              <input
                type="text"
                value={actionRemark}
                onChange={(e) => setActionRemark(e.target.value)}
                placeholder={actionTarget.mode === 'APPROVE' ? 'UTR verified in bank' : 'Payment not received'}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-800 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleRequestAction}
                className={`rounded-lg px-4 py-2 text-xs font-semibold text-white cursor-pointer ${
                  actionTarget.mode === 'APPROVE'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                {busy ? 'Processing...' : actionTarget.mode === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
