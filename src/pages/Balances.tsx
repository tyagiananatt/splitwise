import { useState, useMemo } from 'react';
import { TrendingUp, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { calculateBalances, simplifyDebts } from '../lib/balances';
import { formatCurrency, formatDate, getAvatarColor, getInitials } from '../lib/utils';

export default function Balances() {
  const { groups, expenses, settlements } = useAppStore();
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? '');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const group = groups.find((g) => g.id === selectedGroup);

  const balances = useMemo(() => {
    if (!group) return [];
    return calculateBalances(group.id, expenses, settlements, group);
  }, [group, expenses, settlements]);

  const memberMap: Record<string, string> = {};
  group?.members.forEach((m) => (memberMap[m.userId] = m.name));

  const debts = useMemo(() => {
    if (!group) return [];
    return simplifyDebts(balances, memberMap);
  }, [balances, memberMap]);

  if (groups.length === 0) {
    return (
      <div className="p-6 text-center">
        <TrendingUp className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <p className="text-gray-500">Create a group first to see balances.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Balances</h1>
        <select
          className="input w-auto"
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {group && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {balances.map((b) => (
              <div
                key={b.userId}
                className={`card py-3 text-center cursor-pointer transition-shadow hover:shadow-md ${
                  expandedUser === b.userId ? 'ring-2 ring-indigo-500' : ''
                }`}
                onClick={() => setExpandedUser(expandedUser === b.userId ? null : b.userId)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold mx-auto mb-2 ${getAvatarColor(b.userName)}`}>
                  {getInitials(b.userName)}
                </div>
                <p className="text-sm font-medium text-gray-900">{b.userName}</p>
                <p className={`text-lg font-bold mt-0.5 ${b.net > 0.01 ? 'text-green-600' : b.net < -0.01 ? 'text-red-600' : 'text-gray-500'}`}>
                  {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                </p>
                <p className="text-xs text-gray-400">
                  {b.net > 0.01 ? 'owed to them' : b.net < -0.01 ? 'they owe' : 'settled'}
                </p>
              </div>
            ))}
          </div>

          {/* Simplified debt transactions */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-1">Minimum payments to settle up</h2>
            <p className="text-xs text-gray-500 mb-4">Simplified — fewest transactions to clear all debts</p>

            {debts.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <p className="text-green-700 font-medium">All settled up!</p>
                <p className="text-gray-500 text-sm mt-1">No outstanding balances in this group</p>
              </div>
            ) : (
              <div className="space-y-3">
                {debts.map((d, i) => (
                  <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(d.fromName)}`}>
                      {getInitials(d.fromName)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-red-700">{d.fromName}</span>
                        <ArrowRight className="inline w-3 h-3 mx-1 text-gray-400" />
                        <span className="text-green-700">{d.toName}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {d.fromName} pays {d.toName}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900 text-lg">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-person breakdown — Rohan's "show me exactly which expenses" feature */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-4">Expense breakdown per person</h2>
            <p className="text-xs text-gray-500 mb-4">Click a person above to expand their breakdown</p>

            {balances.map((b) => (
              <div key={b.userId} className="mb-4">
                <button
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  onClick={() => setExpandedUser(expandedUser === b.userId ? null : b.userId)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(b.userName)}`}>
                    {getInitials(b.userName)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 text-sm">{b.userName}</p>
                    <p className="text-xs text-gray-500">
                      Paid {formatCurrency(b.totalPaid)} · Owes {formatCurrency(b.totalOwed)}
                    </p>
                  </div>
                  <span className={`font-semibold text-sm mr-2 ${b.net > 0.01 ? 'text-green-600' : b.net < -0.01 ? 'text-red-600' : 'text-gray-500'}`}>
                    {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                  </span>
                  {expandedUser === b.userId ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>

                {expandedUser === b.userId && b.expenseBreakdown.length > 0 && (
                  <div className="mt-2 ml-4 border-l-2 border-indigo-100 pl-4 space-y-2">
                    <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pb-1 border-b border-gray-100">
                      <span className="col-span-2">Expense</span>
                      <span className="text-right">Paid</span>
                      <span className="text-right">Share</span>
                    </div>
                    {b.expenseBreakdown.map((item) => (
                      <div key={item.expenseId} className="grid grid-cols-4 gap-2 text-xs py-1">
                        <div className="col-span-2">
                          <p className="font-medium text-gray-900 truncate">{item.description}</p>
                          <p className="text-gray-400">{formatDate(item.date)}</p>
                        </div>
                        <p className={`text-right font-medium ${item.youPaid > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                          {item.youPaid > 0 ? formatCurrency(item.youPaid) : '—'}
                        </p>
                        <p className="text-right text-red-500 font-medium">
                          {formatCurrency(item.yourShare)}
                        </p>
                      </div>
                    ))}
                    <div className="grid grid-cols-4 gap-2 text-xs font-bold border-t border-gray-100 pt-2">
                      <span className="col-span-2">Net</span>
                      <span></span>
                      <span className={`text-right ${b.net > 0.01 ? 'text-green-600' : b.net < -0.01 ? 'text-red-600' : 'text-gray-500'}`}>
                        {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
