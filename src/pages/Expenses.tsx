import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Receipt, Search, Trash2, DollarSign } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Expenses() {
  const { expenses, groups, deleteExpense } = useAppStore();
  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterType, setFilterType] = useState('');

  const filtered = useMemo(() => {
    return [...expenses]
      .filter((e) => {
        if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterGroup && e.groupId !== filterGroup) return false;
        if (filterType === 'settlement' && !e.isSettlement) return false;
        if (filterType === 'expense' && e.isSettlement) return false;
        if (filterType === 'foreign' && e.currency === 'INR') return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, search, filterGroup, filterType]);

  const handleDelete = (id: string, desc: string) => {
    if (!confirm(`Delete "${desc}"?`)) return;
    deleteExpense(id);
    toast.success('Expense deleted');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-500 text-sm mt-0.5">{filtered.length} of {expenses.length} expenses</p>
        </div>
        <Link to="/expenses/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Add Expense
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search expenses…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input w-auto" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          <option value="expense">Expenses only</option>
          <option value="settlement">Settlements only</option>
          <option value="foreign">Foreign currency</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 mb-3">{search ? 'No matching expenses' : 'No expenses yet'}</p>
          {!search && (
            <Link to="/expenses/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Add expense
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Expense</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Group</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid by</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Split</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e) => {
                  const group = groups.find((g) => g.id === e.groupId);
                  return (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${e.isSettlement ? 'bg-green-100' : 'bg-indigo-100'}`}>
                            {e.isSettlement ? <DollarSign className="w-3.5 h-3.5 text-green-600" /> : <Receipt className="w-3.5 h-3.5 text-indigo-600" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{e.description}</p>
                            {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{group?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{e.paidByName}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(e.date)}</td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-semibold text-gray-900">{formatCurrency(e.amountInr)}</p>
                        {e.currency !== 'INR' && (
                          <p className="text-xs text-amber-600">{e.currency} {e.amount}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          e.isSettlement ? 'bg-green-100 text-green-700' :
                          e.splitType === 'equal' ? 'bg-indigo-100 text-indigo-700' :
                          e.splitType === 'percentage' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {e.isSettlement ? 'settlement' : e.splitType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(e.id, e.description)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
