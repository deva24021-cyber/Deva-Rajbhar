import React, {useEffect, useState} from 'react';
import QRCode from 'qrcode';
import {Check, Copy, Download, QrCode, X} from 'lucide-react';
import type {B2BUser} from '../types';

interface StaticUpiQrModalProps {
  activeUser: B2BUser;
  onClose: () => void;
  onOpenFundRequest: () => void;
}

export const StaticUpiQrModal: React.FC<StaticUpiQrModalProps> = ({
  activeUser,
  onClose,
  onOpenFundRequest,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const hasParent = Boolean(activeUser.parentUid && activeUser.parentShopName);
  const merchantLabel = hasParent ? activeUser.parentShopName : 'Krishna Recharge HQ';
  const parentPhoneSuffix = activeUser.parentPhone ? activeUser.parentPhone.slice(-4) : '';
  const merchantVpa =
    hasParent && parentPhoneSuffix
      ? `krishnapay.${parentPhoneSuffix}@icici`
      : 'krishnarecharge.b2b@icici';
  const txnNote = `Wallet Load ${activeUser.phone}`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(
    merchantLabel
  )}&tn=${encodeURIComponent(txnNote)}&cu=INR`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiUri, {
      width: 240,
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
  }, [upiUri]);

  const copyVpa = async () => {
    await navigator.clipboard.writeText(merchantVpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `krishna-recharge-upi-qr-${activeUser.phone}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="static-qr-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <QrCode className="h-4 w-4 text-blue-800 shrink-0" />
            <div>
              <h3 id="static-qr-title" className="text-base font-semibold text-slate-900">
                Static Merchant UPI QR
              </h3>
              <p className="text-xs text-slate-500">
                Scan with any UPI app for wallet load · {merchantLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            aria-label="Close QR modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`UPI QR code for ${merchantVpa}`}
              className="h-52 w-52 rounded-lg border border-slate-200 bg-white p-2"
            />
          ) : (
            <div className="flex h-52 w-52 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-400">
              Generating QR...
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold text-slate-900">{merchantVpa}</span>
            <button
              type="button"
              onClick={copyVpa}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-700" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Reference Note: <span className="font-mono text-slate-700">{txnNote}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={downloadQr}
            disabled={!qrDataUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Save QR PNG</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFundRequest();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Submit UTR Request</span>
          </button>
        </div>
      </div>
    </div>
  );
};
