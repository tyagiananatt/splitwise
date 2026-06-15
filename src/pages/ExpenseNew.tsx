import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calculator, Info } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { convertToInr, EXCHANGE_RATES } from '../lib/csvImporter';
import { round2 } from '../lib/balances';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';

type SplitType = 'equal' | 'exact' | 'percentage';

export default function ExpenseNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getGroupsForUser, addExpense } = useAppStore();
  const { user } = useAuthStore();

  const groups = user ? getGroupsForUser(user.id) : [];

  const defaultGroupId = searchParams.get('groupId') ?? '';

  const [groupId, setGroupId] = useState(defaultGroupId || (groups[0]?.id ?? ''));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [paidById, setPaidById] = useState(user?.id ?? '');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});

  const group = groups.find((g) => g.id === groupId);
  const activeMembers = group?.members.filter((m) => {
    if (!m.leftAt) return true;
    if (!date) return true;
    return new Date(date) <= new Date(m.leftAt);
  }) ?? [];

  // Update selected members when group or date changes
  useEffect(() => {
    if (activeMembers.length > 0) {
      setSelectedMembers(activeMembers.map((m) => m.userId));
    }
  }, [groupId, date]);

  const amountNum = parseFloat(amount) || 0;
  const amountInr = convertToInr(amountNum, currency);

  const toggleMember = (uid: string) => {
    setSelectedMembers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const perPersonEqual = selectedMembers.length > 0 ? round2(amountInr / selectedMembers.length) : 0;

  const pctTotal = Object.values(percentages).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const exactTotal = Object.values(exactAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) { toast.error('Select a group'); return; }
    if (!description.trim()) { toast.error('Description required'); return; }
    if (amountNum <= 0) { toast.error('Amount must be > 0'); return; }
    if (selectedMembers.length === 0) { toast.error('Select at least one member'); return; }

    const paidByMember = group.members.find((m) => m.userId === paidById);
    if (!paidByMember) { toast.error('Select payer'); return; }

    // Build shares
    let shares: Array<{ userId: string; userName: string; shareAmount: number; percentage?: number; isExact?: boolean }> = [];

    if (splitType === 'equal') {
      const base = round2(amountInr / selectedMembers.length);
      const remainder = round2(amountInr - base * selectedMembers.length);
      shares = selectedMembers.map((uid, i) => {
        const m = group.members.find((mm) => mm.userId === uid)!;
        return { userId: uid, userName: m.name, shareAmount: i === 0 ? round2(base + remainder) : base };
      });
    } else if (splitType === 'percentage') {
      if (Math.abs(pctTotal - 100) > 0.01) {
        toast.error(`Percentages must total 100% (currently ${pctTotal.toFixed(1)}%)`);
        return;
      }
      shares = selectedMembers.map((uid) => {
        const m = group.members.find((mm) => mm.userId === uid)!;
        const pct = parseFloat(percentages[uid] ?? '0');
        return { userId: uid, userName: m.name, shareAmount: round2((pct / 100) * amountInr), percentage: pct };
      });
    } else {
      // exact
      const inrExactTotal = convertToInr(exactTotal, currency);
      if (Math.abs(inrExactTotal - amountInr) > 1) {
        toast.error(`Exact amounts total ${formatCurrency(inrExactTotal)} but expense is ${formatCurrency(amountInr)}`);
        return;
      }
      shares = selectedMembers.map((uid) => {
        const m = group.members.find((mm) => mm.userId === uid)!;
        const exact = parseFloat(exactAmounts[uid] ?? '0');
        return { userId: uid, userName: m.name, shareAmount: convertToInr(exact, currency), isExact: true };
      });
    }

    addExpense({
      groupId,
      description: description.trim(),
      amount: amountNum,
      currency,
      amountInr,
      exchangeRate: EXCHANGE_RATES[currency.toUpperCase()] ?? 1,
      paidById,
      paidByName: paidByMember.name,
      splitType,
      shares,
      date: new Date(date).toISOString(),
      notes: notes.trim(),
      isSettlement: false,
    });

    toast.success('Expense added');
    navigate(defaultGroupId ? `/groups/${defaultGroupId}` : '/expenses');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Group */}
        <div className="card space-y-4">
          <div>
            <label className="label">Group *</label>
            <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)} required>
              <option value="">Select group</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Description *</label>
            <input className="input" placeholder="e.g. Dinner, Electricity bill" value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount *</label>
              <input type="number" className="input" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} min="0.01" step="0.01" required />
            </div>
            <div>
              <label className="label">Currency</label>
              <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {Object.keys(EXCHANGE_RATES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {currency !== 'INR' && amountNum > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              <Info className="w-4 h-4 flex-shrink-0" />
              Converted: {formatCurrency(amountInr)} (1 {currency} = ₹{EXCHANGE_RATES[currency]})
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Paid by *</label>
              <select className="input" value={paidById} onChange={(e) => setPaidById(e.target.value)}>
                {activeMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input" placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        {/* Split type */}
        <div className="card space-y-4">
          <div>
            <label className="label">Split type</label>
            <div className="grid grid-cols-3 gap-2">
              {(['equal', 'exact', 'percentage'] as SplitType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSplitType(t)}
                  className={`py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                    splitType === t
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Members to split between */}
          {group && (
            <div>
              <label className="label">Split between</label>
              <div className="space-y-2">
                {activeMembers.map((m) => {
                  const isSelected = selectedMembers.includes(m.userId);
                  return (
                    <div key={m.userId} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isSelected ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleMember(m.userId)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-gray-900 flex-1">{m.name}</span>

                      {splitType === 'equal' && isSelected && amountNum > 0 && (
                        <span className="text-sm text-indigo-700 font-medium">{formatCurrency(perPersonEqual)}</span>
                      )}

                      {splitType === 'percentage' && isSelected && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right"
                            placeholder="0"
                            value={percentages[m.userId] ?? ''}
                            onChange={(e) => setPercentages({ ...percentages, [m.userId]: e.target.value })}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                          <span className="text-sm text-gray-500">%</span>
                        </div>
                      )}

                      {splitType === 'exact' && isSelected && (
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-gray-500">{currency}</span>
                          <input
                            type="number"
                            className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right"
                            placeholder="0.00"
                            value={exactAmounts[m.userId] ?? ''}
                            onChange={(e) => setExactAmounts({ ...exactAmounts, [m.userId]: e.target.value })}
                            min="0"
                            step="0.01"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Split validation feedback */}
              {splitType === 'percentage' && (
                <p className={`text-xs mt-2 ${Math.abs(pctTotal - 100) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                  Total: {pctTotal.toFixed(1)}% {Math.abs(pctTotal - 100) < 0.01 ? '✓' : '(must be 100%)'}
                </p>
              )}
              {splitType === 'exact' && amountNum > 0 && (
                <p className={`text-xs mt-2 ${Math.abs(exactTotal - amountNum) < 0.01 ? 'text-green-600' : 'text-red-500'}`}>
                  Total: {formatCurrency(convertToInr(exactTotal, currency))} / {formatCurrency(amountInr)}
                  {Math.abs(exactTotal - amountNum) < 0.01 ? ' ✓' : ''}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" className="btn-primary flex-1 justify-center">
            <Calculator className="w-4 h-4" /> Add Expense
          </button>
        </div>
      </form>
    </div>
  );
}
