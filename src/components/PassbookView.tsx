import React, {useMemo, useState} from 'react';
import {ArrowDownLeft, ArrowUpRight, Download, Search} from 'lucide-react';
import type {B2BUser, LedgerEntry} from '../types';

interface PassbookViewProps {
  activeUser: B2BUser;
  users: B2BUser[];
  ledger: LedgerEntry[];
}

export const PassbookView: React.FC<PassbookViewProps> = ({activeUser, users, ledger}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'SELF' | 'ALL'>('SELF');

  const rows = useMemo(() => {
    let base =
      activeUser.role === 'ADMIN' && scope === 'ALL'
        ? ledger
        : ledger.filter((e) => e.userId === activeUser.id);

    if (filterType !== 'ALL') {
      base = base.filter((e) => e.txnType === filterType);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      base = base.filter(
        (e) =>
          e.remark.toLowerCase().includes(q) ||
          e.referenceId.toLowerCase().includes(q)
      );
    }
    return base;
  }, [activeUser, ledger, filterType, query, scope]);

  const exportCsv = () => {
    const header = 'ID,User,Type,Amount,OpeningBalance,ClosingBalance,Reference,Remark,Timestamp\n';
    const body = rows
      .map((r) => {
        const u = users.find((x) => x.id === r.userId)?.name || String(r.userId);
        return `${r.id},"${u}",${r.txnType},${r.amount.toFixed(2)},${r.openingBalance.toFixed(2)},${r.closingBalance.toFixed(2)},"${r.referenceId}","${r.remark.replace(/"/g, '""')}","${r.createdAt}"`;
      })
      .join('\n');
    const blob = new Blob([header + body], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `krishna-recharge-ledger-${activeUser.phone}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Wallet Passbook &amp; Audit Ledger</h2>
          <p className="text-xs text-slate-500">
            Every rupee movement tracked with opening and closing balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeUser.role === 'ADMIN' && (
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setScope('SELF')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  scope === 'SELF' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                My Ledger
              </button>
              <button
                type="button"
                onClick={() => setScope('ALL')}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  scope === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                All Accounts
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(['ALL', 'CREDIT', 'DEBIT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  filterType === t ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'CREDIT' ? 'Credits' : 'Debits'}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ref or remark..."
              className="rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:border-blue-800 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No ledger entries match the selected filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Reference</th>
                {activeUser.role === 'ADMIN' && scope === 'ALL' && (
                  <th className="px-4 py-3 font-medium">Account</th>
                )}
                <th className="px-4 py-3 font-medium">Particulars</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Opening Bal</th>
                <th className="px-4 py-3 text-right font-medium">Closing Bal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((e) => {
                const isCredit = e.txnType === 'CREDIT';
                const accName = users.find((u) => u.id === e.userId)?.name || `User #${e.userId}`;
                return (
                  <tr key={e.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {e.referenceId || `#${e.id}`}
                    </td>
                    {activeUser.role === 'ADMIN' && scope === 'ALL' && (
                      <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">{accName}</td>
                    )}
                    <td className="px-4 py-2.5 text-slate-800">{e.remark}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-medium ${
                          isCredit ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                        <span>{e.txnType}</span>
                      </span>
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono font-semibold whitespace-nowrap ${
                        isCredit ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {isCredit ? '+' : '-'}₹{e.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-500 whitespace-nowrap">
                      ₹{e.openingBalance.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                      ₹{e.closingBalance.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
