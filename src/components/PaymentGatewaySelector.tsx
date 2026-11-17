import React, {useEffect, useState} from 'react';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Check,
  Copy,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import {adminInstantWalletLoad, submitFundRequest} from '../services/firestoreService';
import type {B2BUser, PaymentMode} from '../types';

export type GatewayChannel = 'UPI' | 'NET_BANKING';

interface PaymentGatewaySelectorProps {
  activeUser: B2BUser;
  initialAmount?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000];
const UPI_APPS = ['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'] as const;
const BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Yes Bank',
] as const;

export const PaymentGatewaySelector: React.FC<PaymentGatewaySelectorProps> = ({
  activeUser,
  initialAmount = '5000',
  onClose,
  onSuccess,
}) => {
  const [gateway, setGateway] = useState<GatewayChannel>('UPI');
  const [amountInput, setAmountInput] = useState<string>(initialAmount);
  const [upiApp, setUpiApp] = useState<(typeof UPI_APPS)[number]>('Google Pay');
  const [selectedBank, setSelectedBank] = useState<(typeof BANKS)[number]>('HDFC Bank');
  const [bankRail, setBankRail] = useState<'IMPS' | 'NEFT'>('IMPS');
  const [requestTo, setRequestTo] = useState<'PARENT' | 'ADMIN'>(
    activeUser.parentUid ? 'PARENT' : 'ADMIN'
  );
  const [utrOrRef, setUtrOrRef] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amountInput) || 0;
  const isAdmin = activeUser.role === 'ADMIN';

  const hasParent = Boolean(activeUser.parentUid && activeUser.parentShopName) && requestTo === 'PARENT';
  const merchantLabel = hasParent ? activeUser.parentShopName : 'Krishna Recharge HQ';
  const merchantVpa =
    hasParent && activeUser.parentPhone
      ? `krishnapay.${activeUser.parentPhone.slice(-4)}@icici`
      : 'krishnarecharge.b2b@icici';

  const virtualAccount = `KRPAY${activeUser.phone.replace(/\D/g, '').slice(-8).padStart(8, '0')}`;
  const ifscCode = 'ICIC0000104';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (gateway !== 'UPI') return;
    let cancelled = false;
    const amParam = amountNum > 0 ? `&am=${amountNum.toFixed(2)}` : '';
    const note = `Instant Load ${activeUser.phone}`;
    const upiUri = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(
      merchantLabel
    )}${amParam}&tn=${encodeURIComponent(note)}&cu=INR`;

    QRCode.toDataURL(upiUri, {
      width: 176,
      margin: 2,
      color: {
        dark: '#0F296D',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [gateway, amountNum, merchantVpa, merchantLabel, activeUser.phone]);

  const copyValue = async (val: string, key: string) => {
    await navigator.clipboard.writeText(val);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(amountNum) || amountNum <= 0 || amountNum > 1000000) {
      setError('Enter a valid amount between ₹1 and ₹10,00,000.');
      return;
    }

    const trimmedRef = utrOrRef.trim().toUpperCase();
    if (!isAdmin && trimmedRef.length < 6) {
      setError(
        gateway === 'UPI'
          ? 'Enter your 12-digit UPI UTR / transaction reference (min 6 characters).'
          : 'Enter your bank IMPS/NEFT reference number (min 6 characters).'
      );
      return;
    }

    const finalRef =
      trimmedRef.length >= 6
        ? trimmedRef
        : `PG${gateway === 'UPI' ? 'UPI' : bankRail}${Date.now().toString().slice(-8)}`;

    setSubmitting(true);
    try {
      if (isAdmin) {
        await adminInstantWalletLoad({
          adminUser: activeUser,
          amount: amountNum,
          gateway,
          channelLabel: gateway === 'UPI' ? upiApp : `${selectedBank} · ${bankRail}`,
          referenceCode: finalRef,
        });
        onSuccess(
          `Central settlement pool credited ₹${amountNum.toFixed(2)} via ${
            gateway === 'UPI' ? `UPI (${upiApp})` : `Net Banking (${selectedBank})`
          } · Ref ${finalRef}.`
        );
      } else {
        const paymentMode: PaymentMode = gateway === 'UPI' ? 'UPI' : bankRail;
        const channelNote =
          gateway === 'UPI'
            ? `Instant Gateway: UPI (${upiApp})`
            : `Instant Gateway: Net Banking (${selectedBank} ${bankRail})`;

        await submitFundRequest({
          activeUser,
          amount: amountNum,
          paymentMode,
          utrNumber: finalRef,
          requestTo,
          remark: channelNote,
        });
        onSuccess(
          `Instant ${
            gateway === 'UPI' ? 'UPI' : `Net Banking (${bankRail})`
          } load request for ₹${amountNum.toFixed(2)} submitted (Ref: ${finalRef}).`
        );
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process wallet load.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pg-selector-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 space-y-5 my-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="pg-selector-title" className="text-base font-semibold text-slate-900">
              Instant Wallet Load Gateway
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {activeUser.shopName} · Current Balance{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-800">
                ₹{activeUser.walletBalance.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close payment gateway selector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
          >
            <AlertCircle className="h-4 w-4 text-red-700 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Method Selector: UPI vs Net Banking */}
          <div>
            <span className="block text-xs font-medium text-slate-700">Select Payment Method</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setGateway('UPI');
                  setError(null);
                }}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  gateway === 'UPI'
                    ? 'border-[#0F296D] bg-blue-50/70 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                    gateway === 'UPI' ? 'bg-[#0F296D] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900">UPI</div>
                  <div className="text-[11px] text-slate-500 truncate">Dynamic QR &amp; UPI Apps</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setGateway('NET_BANKING');
                  setError(null);
                }}
                className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  gateway === 'NET_BANKING'
                    ? 'border-[#0F296D] bg-blue-50/70 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg shrink-0 ${
                    gateway === 'NET_BANKING' ? 'bg-[#0F296D] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900">Net Banking</div>
                  <div className="text-[11px] text-slate-500 truncate">IMPS &amp; NEFT Bank Portal</div>
                </div>
              </button>
            </div>
          </div>

          {/* Load Amount + Presets */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="pg-amount" className="block text-xs font-medium text-slate-700">
                  Load Amount (INR)
                </label>
                <input
                  id="pg-amount"
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono tabular-nums text-sm font-semibold text-slate-900 focus:border-[#0F296D] focus:outline-none"
                  required
                />
              </div>

              {!isAdmin && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">Credit Approver</label>
                  <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                    {(['PARENT', 'ADMIN'] as const).map((target) => {
                      const disabled = target === 'PARENT' && !activeUser.parentUid;
                      return (
                        <button
                          key={target}
                          type="button"
                          disabled={disabled}
                          onClick={() => setRequestTo(target)}
                          className={`rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer ${
                            requestTo === target ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                          }`}
                        >
                          {target === 'PARENT' ? 'Upline' : 'Admin HQ'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_AMOUNTS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountInput(String(preset))}
                  className={`rounded-md border px-2.5 py-1 font-mono tabular-nums text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    amountNum === preset
                      ? 'border-[#0F296D] bg-[#0F296D] text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  +₹{preset.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Gateway-specific instructions */}
          {gateway === 'UPI' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex flex-col items-center shrink-0">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`UPI payment QR for ${merchantVpa}`}
                      className="h-36 w-36 rounded-lg border border-slate-200 bg-white p-1.5"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-400">
                      Loading QR...
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3 min-w-0">
                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Payable To · {merchantLabel}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900 truncate">
                        {merchantVpa}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyValue(merchantVpa, 'vpa')}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 shrink-0 cursor-pointer"
                      >
                        {copiedField === 'vpa' ? (
                          <Check className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedField === 'vpa' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-500">Preferred UPI App</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {UPI_APPS.map((app) => (
                        <button
                          key={app}
                          type="button"
                          onClick={() => setUpiApp(app)}
                          className={`rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            upiApp === app
                              ? 'border-[#0F296D] bg-white text-[#0F296D] font-semibold'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {app}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="pg-bank" className="block text-xs font-medium text-slate-700">
                    Select Bank
                  </label>
                  <select
                    id="pg-bank"
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value as (typeof BANKS)[number])}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-[#0F296D] focus:outline-none"
                  >
                    {BANKS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="block text-xs font-medium text-slate-700">Transfer Rail</span>
                  <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg bg-slate-200/70 p-1">
                    {(['IMPS', 'NEFT'] as const).map((rail) => (
                      <button
                        key={rail}
                        type="button"
                        onClick={() => setBankRail(rail)}
                        className={`rounded-md py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          bankRail === rail ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                        }`}
                      >
                        {rail}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-slate-200 pt-3 text-xs sm:grid-cols-2">
                <div>
                  <div className="text-[11px] text-slate-500">Virtual Settlement Account</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-900">{virtualAccount}</span>
                    <button
                      type="button"
                      onClick={() => copyValue(virtualAccount, 'acct')}
                      className="text-slate-500 hover:text-[#0F296D] cursor-pointer"
                      aria-label="Copy virtual account number"
                    >
                      {copiedField === 'acct' ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">IFSC Code (ICICI Pool)</div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-900">{ifscCode}</span>
                    <button
                      type="button"
                      onClick={() => copyValue(ifscCode, 'ifsc')}
                      className="text-slate-500 hover:text-[#0F296D] cursor-pointer"
                      aria-label="Copy IFSC code"
                    >
                      {copiedField === 'ifsc' ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reference / UTR Input */}
          <div>
            <label htmlFor="pg-utr" className="block text-xs font-medium text-slate-700">
              {gateway === 'UPI' ? 'UPI UTR / Transaction Reference' : `${bankRail} Bank Reference / UTR`}
              {isAdmin ? ' (Optional for HQ Pool Load)' : ''}
            </label>
            <input
              id="pg-utr"
              type="text"
              maxLength={100}
              value={utrOrRef}
              onChange={(e) => setUtrOrRef(e.target.value)}
              placeholder={
                gateway === 'UPI' ? 'e.g. 431982014412' : 'e.g. IMPS9928172635'
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase text-slate-900 focus:border-[#0F296D] focus:outline-none"
              required={!isAdmin}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <span>{isAdmin ? 'Direct Firestore pool ledger' : 'Queued for instant approver credit'}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F296D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#133B8C] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>
                  {submitting
                    ? 'Processing...'
                    : isAdmin
                    ? `Load ₹${amountNum.toLocaleString('en-IN')}`
                    : 'Confirm & Submit'}
                </span>
                {!submitting && <ArrowRight className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
