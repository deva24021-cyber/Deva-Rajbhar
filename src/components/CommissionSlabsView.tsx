import React, {useMemo, useState} from 'react';
import {AlertCircle, CheckCircle2, Save} from 'lucide-react';
import {updateCommissionSlab} from '../services/firestoreService';
import type {B2BUser, CommissionPackage, CommissionSlab} from '../types';

interface CommissionSlabsViewProps {
  activeUser: B2BUser;
  packages: CommissionPackage[];
  slabs: CommissionSlab[];
}

export const CommissionSlabsView: React.FC<CommissionSlabsViewProps> = ({
  activeUser,
  packages,
  slabs,
}) => {
  const [simOp, setSimOp] = useState('AIRTEL');
  const [simAmount, setSimAmount] = useState('1000');
  const [editingSlab, setEditingSlab] = useState<{id: string; value: string} | null>(null);
  const [feedback, setFeedback] = useState<{type: 'success' | 'error'; message: string} | null>(null);

  const operators = useMemo(() => {
    const map = new Map<string, {code: string; name: string; serviceType: string}>();
    slabs.forEach((s) => {
      if (!map.has(s.operatorCode)) {
        map.set(s.operatorCode, {code: s.operatorCode, name: s.operatorName, serviceType: s.serviceType});
      }
    });
    return Array.from(map.values());
  }, [slabs]);

  const simSplit = useMemo(() => {
    const amt = Number(simAmount) || 0;
    const getRate = (pkgId: string) =>
      slabs.find((s) => s.packageId === pkgId && s.operatorCode === simOp)?.commissionPercent ?? 0;

    const adminRate = getRate('pkg_admin_root');
    const mdRate = getRate('pkg_md_platinum');
    const distRate = getRate('pkg_dist_prime');
    const retRate = getRate('pkg_retailer_gold');

    const retComm = +((amt * retRate) / 100).toFixed(2);
    const distDiff = Math.max(0, +(distRate - retRate).toFixed(2));
    const distComm = +((amt * distDiff) / 100).toFixed(2);
    const mdDiff = Math.max(0, +(mdRate - distRate).toFixed(2));
    const mdComm = +((amt * mdDiff) / 100).toFixed(2);
    const adminDiff = Math.max(0, +(adminRate - mdRate).toFixed(2));
    const adminComm = +((amt * adminDiff) / 100).toFixed(2);

    return {
      amt,
      retRate,
      retComm,
      distDiff,
      distComm,
      mdDiff,
      mdComm,
      adminDiff,
      adminComm,
    };
  }, [slabs, simOp, simAmount]);

  const saveSlab = async (slabId: string, val: string) => {
    setFeedback(null);
    try {
      await updateCommissionSlab({
        slabId,
        commissionPercent: Number(val),
      });
      setEditingSlab(null);
      setFeedback({type: 'success', message: 'Commission slab rate updated in Firestore.'});
    } catch (err) {
      setFeedback({type: 'error', message: err instanceof Error ? err.message : 'Update failed'});
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

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">B2B Margin Split Simulator</h2>
            <p className="mt-1 text-xs text-slate-500">
              Preview how profit flows up from Retailer to Distributor, Master Distributor, and Admin HQ.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="sim-op" className="block text-[11px] font-medium text-slate-500">
                Operator
              </label>
              <select
                id="sim-op"
                value={simOp}
                onChange={(e) => setSimOp(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
              >
                {operators.map((op) => (
                  <option key={op.code} value={op.code}>
                    {op.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sim-amt" className="block text-[11px] font-medium text-slate-500">
                Recharge Amount (₹)
              </label>
              <input
                id="sim-amt"
                type="number"
                min="1"
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs text-slate-500">Retailer Commission</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">₹{simSplit.retComm.toFixed(2)}</div>
            <div className="mt-0.5 font-mono text-[11px] text-emerald-700">{simSplit.retRate.toFixed(2)}% flat</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs text-slate-500">Distributor Differential</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">₹{simSplit.distComm.toFixed(2)}</div>
            <div className="mt-0.5 font-mono text-[11px] text-blue-800">+{simSplit.distDiff.toFixed(2)}% override</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs text-slate-500">Master Distributor Diff</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">₹{simSplit.mdComm.toFixed(2)}</div>
            <div className="mt-0.5 font-mono text-[11px] text-blue-800">+{simSplit.mdDiff.toFixed(2)}% override</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="text-xs text-slate-500">Admin HQ Net Margin</div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900">₹{simSplit.adminComm.toFixed(2)}</div>
            <div className="mt-0.5 font-mono text-[11px] text-slate-600">+{simSplit.adminDiff.toFixed(2)}% retained</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Commission Slab Matrix</h2>
          <p className="text-xs text-slate-500">
            {activeUser.role === 'ADMIN'
              ? 'Click any rate cell to edit percentage payout for that package.'
              : 'Read-only commission schedule across B2B tiers.'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Operator</th>
                <th className="px-4 py-3 font-medium">Service</th>
                {packages.map((pkg) => (
                  <th key={pkg.id} className="px-4 py-3 text-right font-medium">
                    {pkg.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {operators.map((op) => (
                <tr key={op.code} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">{op.name}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{op.serviceType}</td>
                  {packages.map((pkg) => {
                    const slab = slabs.find(
                      (s) => s.packageId === pkg.id && s.operatorCode === op.code
                    );
                    if (!slab) return <td key={pkg.id} className="px-4 py-3 text-right">—</td>;
                    const isEditing = editingSlab?.id === slab.id;

                    return (
                      <td key={pkg.id} className="px-4 py-3 text-right font-mono whitespace-nowrap">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.05"
                              min="0"
                              max="15"
                              value={editingSlab.value}
                              onChange={(e) => setEditingSlab({id: slab.id, value: e.target.value})}
                              className="w-16 rounded border border-blue-800 px-1.5 py-0.5 text-right font-mono text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => saveSlab(slab.id, editingSlab.value)}
                              className="rounded bg-blue-800 p-1 text-white hover:bg-blue-900 cursor-pointer"
                              aria-label="Save rate"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                          </div>
                        ) : activeUser.role === 'ADMIN' ? (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingSlab({id: slab.id, value: String(slab.commissionPercent)})
                            }
                            className="rounded px-2 py-0.5 text-slate-900 hover:bg-blue-50 hover:text-blue-900 cursor-pointer"
                          >
                            {slab.commissionPercent.toFixed(2)}%
                          </button>
                        ) : (
                          <span className="text-slate-900">{slab.commissionPercent.toFixed(2)}%</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
