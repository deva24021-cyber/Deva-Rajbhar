import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, CreditCard, Send, XCircle} from 'lucide-react';
import {
  actOnFundRequest,
  directWalletTransfer,
  submitFundRequest as submitFundRequestToDb,
} from '../services/firestoreService';
import type {B2BUser, FundRequest, PaymentMode} from '../types';
import {PaymentGatewaySelector} from './PaymentGatewaySelector';

interface WalletFundViewProps {
  activeUser: B2BUser;
  users: B2BUser[];
  fundRequests: FundRequest[];
}

export const WalletFundView: React.FC<WalletFundViewProps> = ({
  activeUser,
  users,
  fundRequests,
}) => {
  const [reqAmount, setReqAmount] = useState('5000');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [requestTo, setRequestTo] = useState<'PARENT' | 'ADMIN'>(
    activeUser.parentUid ? 'PARENT' : 'ADMIN'
  );
  const [reqRemark, setReqRemark] = useState('');
  const [showGatewayModal, setShowGatewayModal] = useState(false);

  const downlineUsers = useMemo(() => {
    if (activeUser.role === 'ADMIN') return users.filter((u) => u.uid !== activeUser.uid);
    return users.filter((u) => u.parentUid === activeUser.uid);
  }, [activeUser, users]);

  const [receiverUid, setReceiverUid] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState('2000');
  const [transferTpin, setTransferTpin] = useState('');
  const [transferRemark, setTransferRemark] = useState('');

  const [actionTarget, setActionTarget] = useState<{req: FundRequest; mode: 'APPROVE' | 'REJECT'} | null>(null);
  const [actionTpin, setActionTpin] = useState('');
  const [actionRemark, setActionRemark] = useState('');

  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedReceiverUid = receiverUid || downlineUsers[0]?.uid || '';

  const visibleRequests = useMemo(() => {
    if (activeUser.role === 'ADMIN') return fundRequests;
    return fundRequests.filter(
      (fr) => fr.requesterUid === activeUser.uid || fr.approverUid === activeUser.uid
    );
  }, [activeUser, fundRequests]);

  const handleFundRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await submitFundRequestToDb({
        activeUser,
        amount: Number(reqAmount),
        paymentMode,
        utrNumber,
        requestTo,
        remark: reqRemark,
      });
      setUtrNumber('');
      setReqRemark('');
      setFeedback({type: 'success', message: 'Fund request submitted and queued for approver verification.'});
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Request failed'});
    } finally {
      setBusy(false);
    }
  };

  const handleDirectTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const receiver = downlineUsers.find((u) => u.uid === selectedReceiverUid);
      if (!receiver) throw new Error('Select a valid downline recipient.');
      await directWalletTransfer({
        sender: activeUser,
        receiver,
        amount: Number(transferAmount),
        tpin: transferTpin,
        remark: transferRemark || 'Direct Wallet Load',
      });
      setTransferTpin('');
      setTransferRemark('');
      setFeedback({type: 'success', message: `Transferred ₹${Number(transferAmount).toFixed(2)} to ${receiver.name}.`});
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
      await actOnFundRequest({
        approver: activeUser,
        fundRequest: actionTarget.req,
        action: actionTarget.mode,
        tpin: actionTpin,
        actionRemark,
      });
      const verb = actionTarget.mode === 'APPROVE'
        ? `Approved ₹${actionTarget.req.amount.toFixed(2)} for ${actionTarget.req.requesterName}.`
        : 'Fund request rejected.';
      setActionTarget(null);
      setActionTpin('');
      setActionRemark('');
      setFeedback({type: 'success', message: verb});
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
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Instant Wallet Load</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Load funds via UPI QR / Apps or Net Banking (IMPS / NEFT) gateway.
                </p>
              </div>
              <CreditCard className="h-5 w-5 text-[#0F296D] shrink-0" />
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setShowGatewayModal(true);
              }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F296D] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#133B8C] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Select UPI or Net Banking</span>
            </button>
          </div>

          {activeUser.role !== 'ADMIN' && (
            <form
              onSubmit={handleFundRequestSubmit}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Submit Fund Request</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Deposit funds via UPI/IMPS/NEFT and submit your UTR for upline or Admin HQ approval.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">Request To</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    {(['PARENT', 'ADMIN'] as const).map((target) => {
                      const disabled = target === 'PARENT' && !activeUser.parentUid;
                      return (
                        <button
                          key={target}
                          type="button"
                          disabled={disabled}
                          onClick={() => setRequestTo(target)}
                          className={`rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer ${
                            requestTo === target ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          {target === 'PARENT' ? 'Upline' : 'Admin HQ'}
                        </button>
                      );
                    })}
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
                    max="1000000"
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
                      maxLength={100}
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
                  maxLength={255}
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
              onSubmit={handleDirectTransferSubmit}
              className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Direct Downline Wallet Transfer</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Push balance immediately to a downline member using atomic Firestore transactions.
                </p>
              </div>

              <div>
                <label htmlFor="trf-receiver" className="block text-xs font-medium text-slate-700">
                  Recipient Account
                </label>
                <select
                  id="trf-receiver"
                  value={selectedReceiverUid}
                  onChange={(e) => setReceiverUid(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-blue-800 focus:outline-none"
                >
                  {downlineUsers.length === 0 ? (
                    <option value="">No downline partners available</option>
                  ) : (
                    downlineUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.name} ({u.role} · Bal ₹{u.walletBalance.toFixed(2)})
                      </option>
                    ))
                  )}
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
                    max="1000000"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-800 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="trf-pin" className="block text-xs font-medium text-slate-700">
                    Your T-PIN
                  </label>
                  <input
                    id="trf-pin"
                    type="password"
                    maxLength={6}
                    value={transferTpin}
                    onChange={(e) => setTransferTpin(e.target.value)}
                    placeholder="Enter T-PIN"
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
                  maxLength={255}
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
                    const canAct =
                      fr.status === 'PENDING' &&
                      (fr.approverUid === activeUser.uid || activeUser.role === 'ADMIN');

                    return (
                      <tr key={fr.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{fr.requesterName}</div>
                          <div className="text-[11px] text-slate-500">{fr.requesterRole}</div>
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
                          {fr.approverName || 'Krishna Recharge HQ'}
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
              Ref <span className="font-mono">{actionTarget.req.id}</span> · UTR{' '}
              <span className="font-mono font-semibold">{actionTarget.req.utrNumber}</span> · Amount{' '}
              <span className="font-mono font-semibold">₹{actionTarget.req.amount.toFixed(2)}</span>
            </p>

            {actionTarget.mode === 'APPROVE' && (
              <div>
                <label className="block text-xs font-medium text-slate-700">Approver T-PIN</label>
                <input
                  type="password"
                  maxLength={6}
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
                maxLength={255}
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

      {showGatewayModal && (
        <PaymentGatewaySelector
          activeUser={activeUser}
          initialAmount={reqAmount}
          onClose={() => setShowGatewayModal(false)}
          onSuccess={(message) => setFeedback({type: 'success', message})}
        />
      )}
    </div>
  );
};

export const FundRequestView = WalletFundView;
