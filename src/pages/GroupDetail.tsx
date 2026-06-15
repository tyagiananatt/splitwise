import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, UserPlus, UserMinus, Receipt,
  DollarSign, X, CheckCircle, Clock
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { getUserByEmail } from '../lib/userRegistry';
import { calculateBalances, simplifyDebts } from '../lib/balances';
import { formatCurrency, formatDate, getAvatarColor, getInitials } from '../lib/utils';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groups, expenses, settlements, addMember, removeMember, addSettlement } = useAppStore();
  const { user } = useAuthStore();

  const [tab, setTab] = useState<'expenses' | 'balances' | 'members'>('expenses');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newJoinedAt, setNewJoinedAt] = useState(new Date().toISOString().split('T')[0]);
  const [settleFrom, setSettleFrom] = useState('');
  const [settleTo, setSettleTo] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split('T')[0]);

  const group = groups.find((g) => g.id === id);
  if (!group) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Group not found.</p>
      <Link to="/groups" className="text-indigo-600 mt-2 inline-block">← Back to groups</Link>
    </div>
  );

  const groupExpenses = useMemo(() =>
    expenses.filter((e) => e.groupId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [expenses, id]
  );

  const balances = useMemo(() => calculateBalances(id!, expenses, settlements, group), [id, expenses, settlements, group]);
  const memberMap: Record<string, string> = {};
  group.members.forEach((m) => (memberMap[m.userId] = m.name));
  const debts = useMemo(() => simplifyDebts(balances, memberMap), [balances, memberMap]);

  const handleAddMember = () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }

    // Same logic as GroupNew: look up by email first
    const registered = newEmail.trim() ? getUserByEmail(newEmail.trim()) : null;

    let memberId: string;
    let memberName: string;
    let linked: boolean;

    if (registered) {
      // Check if already a member
      if (group.members.some((m) => m.userId === registered.id)) {
        toast.error(`${registered.name} is already in this group`);
        return;
      }
      memberId   = registered.id;
      memberName = registered.name;
      linked     = true;
    } else {
      // No account yet — use a stable placeholder keyed to their email
      // so Register.tsx can patch it later via relinkMember
      memberId   = newEmail.trim()
        ? `placeholder-${newEmail.trim().toLowerCase()}`
        : uuidv4();

      if (group.members.some((m) => m.userId === memberId)) {
        toast.error('This person is already in the list');
        return;
      }
      memberName = newName.trim();
      linked     = false;
    }

    addMember(id!, {
      userId:   memberId,
      name:     memberName,
      email:    newEmail.trim().toLowerCase(),
      joinedAt: new Date(newJoinedAt).toISOString(),
      leftAt:   null,
      role:     'member',
    });

    setNewName('');
    setNewEmail('');
    setShowAddMember(false);

    if (linked) {
      toast.success(`${memberName} added and linked to their account`);
    } else {
      toast.success(`${memberName} added — they'll be linked when they register with ${newEmail || 'their email'}`);
    }
  };

  const handleRemoveMember = (userId: string, name: string) => {
    if (!confirm(`Mark ${name} as left today?`)) return;
    removeMember(id!, userId, new Date().toISOString());
    toast.success(`${name} marked as left`);
  };

  const handleSettle = () => {
    if (!settleFrom || !settleTo || !settleAmount) { toast.error('Fill all fields'); return; }
    const fromMember = group.members.find((m) => m.userId === settleFrom);
    const toMember = group.members.find((m) => m.userId === settleTo);
    if (!fromMember || !toMember) return;

    addSettlement({
      groupId: id!,
      payerId: settleFrom,
      payerName: fromMember.name,
      payeeId: settleTo,
      payeeName: toMember.name,
      amount: parseFloat(settleAmount),
      currency: group.currency,
      date: new Date(settleDate).toISOString(),
      notes: '',
    });

    setShowSettle(false);
    setSettleAmount('');
    toast.success('Settlement recorded');
  };

  const totalSpent = groupExpenses
    .filter((e) => !e.isSettlement)
    .reduce((s, e) => s + e.amountInr, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/groups')} className="p-2 rounded-xl hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          {group.description && <p className="text-gray-500 text-sm">{group.description}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettle(true)} className="btn-success">
            <DollarSign className="w-4 h-4" /> Settle up
          </button>
          <Link to={`/expenses/new?groupId=${id}`} className="btn-primary">
            <Plus className="w-4 h-4" /> Add expense
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalSpent)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total spent</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-900">{group.members.filter((m) => !m.leftAt).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active members</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-gray-900">{groupExpenses.filter((e) => !e.isSettlement).length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Expenses</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {(['expenses', 'balances', 'members'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Expenses tab */}
      {tab === 'expenses' && (
        <div className="space-y-3">
          {groupExpenses.length === 0 ? (
            <div className="card text-center py-12">
              <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 mb-3">No expenses yet</p>
              <Link to={`/expenses/new?groupId=${id}`} className="btn-primary">
                <Plus className="w-4 h-4" /> Add first expense
              </Link>
            </div>
          ) : (
            groupExpenses.map((e) => (
              <div key={e.id} className="card hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${e.isSettlement ? 'bg-green-100' : 'bg-indigo-100'}`}>
                    {e.isSettlement ? <DollarSign className="w-5 h-5 text-green-600" /> : <Receipt className="w-5 h-5 text-indigo-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">{e.description}</p>
                        <p className="text-sm text-gray-500">
                          {e.paidByName} paid · {formatDate(e.date)}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-gray-900">{formatCurrency(e.amountInr)}</p>
                        {e.currency !== 'INR' && (
                          <p className="text-xs text-amber-600">{e.currency} {e.amount} @ {e.exchangeRate}</p>
                        )}
                      </div>
                    </div>
                    {!e.isSettlement && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {e.shares.map((s) => (
                          <span key={s.userId} className="badge-gray text-xs">
                            {s.userName}: {formatCurrency(s.shareAmount)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        e.isSettlement ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {e.isSettlement ? 'settlement' : e.splitType}
                      </span>
                      {e.importRowNum && (
                        <span className="badge-gray text-xs">imported row #{e.importRowNum}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Balances tab */}
      {tab === 'balances' && (
        <div className="space-y-4">
          {/* Simplified debts */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Settle up (simplified)</h3>
            {debts.length === 0 ? (
              <p className="text-green-600 text-sm font-medium">✓ All settled up!</p>
            ) : (
              <div className="space-y-2">
                {debts.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(d.fromName)}`}>
                      {getInitials(d.fromName)}
                    </div>
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{d.fromName}</span>
                      <span className="text-gray-500"> owes </span>
                      <span className="font-medium">{d.toName}</span>
                    </div>
                    <span className="font-semibold text-red-600">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Per-person balances */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Individual balances</h3>
            <div className="space-y-3">
              {balances.map((b) => (
                <div key={b.userId}>
                  <div className="flex items-center gap-3 mb-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${getAvatarColor(b.userName)}`}>
                      {getInitials(b.userName)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{b.userName}</p>
                      <p className="text-xs text-gray-500">Paid {formatCurrency(b.totalPaid)} · Owes {formatCurrency(b.totalOwed)}</p>
                    </div>
                    <span className={`font-semibold text-sm ${b.net > 0.01 ? 'text-green-600' : b.net < -0.01 ? 'text-red-600' : 'text-gray-500'}`}>
                      {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        <div className="space-y-3">
          <button onClick={() => setShowAddMember(!showAddMember)} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add member
          </button>

          {showAddMember && (
            <div className="card space-y-3 border-indigo-100">
              <h3 className="font-semibold text-gray-900">Add new member</h3>

              {/* Info */}
              <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', fontSize: '0.75rem', color: '#6B7280' }}>
                Enter their <strong>email</strong> — if they've already registered, they'll be linked instantly.
                If not, add their email anyway and they'll be linked automatically when they sign up.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Name *</label>
                  <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Email (for linking)</label>
                  <input className="input" type="email" placeholder="their@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Joined date</label>
                <input className="input" type="date" value={newJoinedAt} onChange={(e) => setNewJoinedAt(e.target.value)} />
              </div>

              {/* Live lookup feedback */}
              {newEmail.trim() && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: getUserByEmail(newEmail.trim()) ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${getUserByEmail(newEmail.trim()) ? '#BBF7D0' : '#FDE68A'}`,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                }}>
                  {getUserByEmail(newEmail.trim()) ? (
                    <>
                      <CheckCircle style={{ width: '14px', height: '14px', color: '#16A34A', flexShrink: 0 }} />
                      <span style={{ color: '#166534' }}>
                        Found: <strong>{getUserByEmail(newEmail.trim())!.name}</strong> — will be linked immediately
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0 }} />
                      <span style={{ color: '#92400E' }}>
                        No account yet — member will link when they register with this email
                      </span>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setShowAddMember(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleAddMember} disabled={!newName.trim()} className="btn-primary">Add member</button>
              </div>
            </div>
          )}

          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900">Current members</h3>
            {group.members.map((m) => {
              const isLinked = !m.userId.startsWith('placeholder-');
              return (
                <div key={m.userId} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${getAvatarColor(m.name)}`}>
                    {getInitials(m.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      {m.name}
                      {m.role === 'admin' && <span className="badge-blue text-xs">admin</span>}
                      {m.leftAt && <span className="badge-red text-xs">left {formatDate(m.leftAt)}</span>}
                      {isLinked
                        ? <span className="badge-green text-xs">✓ linked</span>
                        : <span className="badge-yellow text-xs">⏳ pending</span>
                      }
                    </p>
                    <p className="text-xs text-gray-500">
                      {m.email || 'no email'} · Joined {formatDate(m.joinedAt)}
                    </p>
                  </div>
                  {!m.leftAt && m.userId !== user?.id && (
                    <button
                      onClick={() => handleRemoveMember(m.userId, m.name)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                      title="Mark as left"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {showSettle && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 modal-backdrop">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-lg">Record settlement</h3>
              <button onClick={() => setShowSettle(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Who's paying?</label>
                <select className="input" value={settleFrom} onChange={(e) => setSettleFrom(e.target.value)}>
                  <option value="">Select payer</option>
                  {group.members.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Paying to?</label>
                <select className="input" value={settleTo} onChange={(e) => setSettleTo(e.target.value)}>
                  <option value="">Select recipient</option>
                  {group.members.filter((m) => m.userId !== settleFrom).map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Amount ({group.currency})</label>
                <input type="number" className="input" placeholder="0.00" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} min="0.01" step="0.01" />
              </div>
              <div>
                <label className="label">Date</label>
                <input type="date" className="input" value={settleDate} onChange={(e) => setSettleDate(e.target.value)} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowSettle(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                <button onClick={handleSettle} className="btn-success flex-1 justify-center">Record payment</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
