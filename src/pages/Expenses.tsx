import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Receipt, Search, Trash2, DollarSign } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Expenses() {
  const { getGroupsForUser, getExpensesForUser, deleteExpense } = useAppStore();
  const { user } = useAuthStore();

  const groups   = user ? getGroupsForUser(user.id)   : [];
  const expenses = user ? getExpensesForUser(user.id) : [];

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
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.125rem' }}>Expenses</h1>
          <p style={{ fontSize: '0.75rem', color: '#9CA3AF', margin: 0, paddingTop: '0.375rem' }}>
            {filtered.length} of {expenses.length}
          </p>
        </div>
        {/* Outlined dark button */}
        <Link
          to="/expenses/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.5rem 1rem',
            border: '1.5px solid #0F1117',
            borderRadius: '0.375rem',
            background: 'white',
            color: '#0F1117',
            fontWeight: 500,
            fontSize: '0.875rem',
            textDecoration: 'none',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#0F1117';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'white';
            e.currentTarget.style.color = '#0F1117';
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add Expense
        </Link>
      </div>

      {/* ── Filters ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
          <input
            className="input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Search expenses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input" style={{ width: 'auto' }} value={filterGroup} onChange={(e) => setFilterGroup(e.target.value)}>
          <option value="">All groups</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="input" style={{ width: 'auto' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All types</option>
          <option value="expense">Expenses</option>
          <option value="settlement">Settlements</option>
          <option value="foreign">Foreign currency</option>
        </select>
      </div>

      {/* ── Table ──────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Receipt style={{ width: '2.5rem', height: '2.5rem', color: '#E5E7EB', margin: '0 auto 0.75rem' }} />
          <p style={{ color: '#9CA3AF', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            {search ? 'No matching expenses' : 'No expenses yet'}
          </p>
          {!search && (
            <Link to="/expenses/new" className="btn-primary">
              <Plus className="w-3.5 h-3.5" /> Add expense
            </Link>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB', background: 'white' }}>
                  {['Expense', 'Group', 'Paid by', 'Date', 'Amount', 'Split', ''].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '0.625rem 1rem',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        textAlign: i === 4 ? 'right' : i === 5 ? 'center' : 'left',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, rowIdx) => {
                  const group = groups.find((g) => g.id === e.groupId);
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr
                      key={e.id}
                      style={{
                        background: isEven ? '#FFFFFF' : '#F8F8F8',
                        transition: 'box-shadow 0.1s',
                      }}
                      onMouseEnter={(ev) => {
                        ev.currentTarget.style.boxShadow = 'inset 3px 0 0 #16A34A';
                      }}
                      onMouseLeave={(ev) => {
                        ev.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Expense */}
                      <td style={{ padding: '0.625rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            style={{
                              width: '26px', height: '26px',
                              background: '#F3F4F6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {e.isSettlement
                              ? <DollarSign style={{ width: '12px', height: '12px', color: '#6B7280' }} />
                              : <Receipt style={{ width: '12px', height: '12px', color: '#6B7280' }} />
                            }
                          </div>
                          <div>
                            <p style={{ fontWeight: 500, color: '#111827', margin: 0 }}>{e.description}</p>
                            {e.notes && (
                              <p style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: 0 }}>{e.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Group */}
                      <td style={{ padding: '0.625rem 1rem', color: '#6B7280' }}>
                        {group?.name ?? '—'}
                      </td>

                      {/* Paid by */}
                      <td style={{ padding: '0.625rem 1rem', color: '#6B7280' }}>
                        {e.paidByName}
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.625rem 1rem', color: '#9CA3AF', whiteSpace: 'nowrap' }}>
                        {formatDate(e.date)}
                      </td>

                      {/* Amount — mono, right-aligned, black */}
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'right' }}>
                        <span
                          className="mono"
                          style={{ fontWeight: 600, color: '#111827' }}
                        >
                          {formatCurrency(e.amountInr)}
                        </span>
                        {e.currency !== 'INR' && (
                          <p style={{ fontSize: '0.65rem', color: '#D97706', margin: 0, textAlign: 'right' }}>
                            {e.currency} {e.amount}
                          </p>
                        )}
                      </td>

                      {/* Split — plain mono text, no pill */}
                      <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                        <span
                          className="mono"
                          style={{ fontSize: '0.7rem', color: '#9CA3AF' }}
                        >
                          {e.isSettlement ? 'settle' : e.splitType}
                        </span>
                      </td>

                      {/* Delete */}
                      <td style={{ padding: '0.625rem 1rem' }}>
                        <button
                          onClick={() => handleDelete(e.id, e.description)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '0.25rem' }}
                          onMouseEnter={(ev) => (ev.currentTarget.style.color = '#DC2626')}
                          onMouseLeave={(ev) => (ev.currentTarget.style.color = '#D1D5DB')}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
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
