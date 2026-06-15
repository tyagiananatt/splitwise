import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Receipt, Upload, Plus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { calculateBalances, simplifyDebts } from '../lib/balances';
import { formatCurrency, formatDate, getInitials } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { getGroupsForUser, getExpensesForUser, settlements } = useAppStore();

  // Only groups + expenses this user is actually a member of
  const groups   = user ? getGroupsForUser(user.id)   : [];
  const expenses = user ? getExpensesForUser(user.id) : [];

  const stats = useMemo(() => {
    let totalOwed = 0;
    let totalOwing = 0;
    const allDebts: ReturnType<typeof simplifyDebts> = [];

    for (const group of groups) {
      const balances = calculateBalances(group.id, expenses, settlements, group);
      const memberMap: Record<string, string> = {};
      group.members.forEach((m) => (memberMap[m.userId] = m.name));
      const debts = simplifyDebts(balances, memberMap);
      allDebts.push(...debts);

      const myBalance = balances.find((b) => b.userId === user?.id);
      if (myBalance) {
        if (myBalance.net > 0) totalOwed += myBalance.net;
        else totalOwing += Math.abs(myBalance.net);
      }
    }

    return {
      totalOwed,
      totalOwing,
      myDebts: allDebts.filter((d) => d.from === user?.id || d.to === user?.id),
    };
  }, [groups, expenses, settlements, user]);

  const recentExpenses = useMemo(() =>
    [...expenses]
      .filter((e) => !e.isSettlement)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5),
    [expenses]
  );

  const netBalance = stats.totalOwed - stats.totalOwing;

  // hover state for settle-up rows
  const [hoveredDebt, setHoveredDebt] = useState<number | null>(null);

  // greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 2rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Header ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>
          {greeting}, {user?.name?.split(' ')[0]}.
        </h1>
        <Link to="/groups/new" className="btn-primary">
          <Plus className="w-3.5 h-3.5" /> New Group
        </Link>
      </div>

      {/* ── Ledger bar (replaces 3 colored cards) ────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'white',
          borderBottom: '1px solid #E5E5E5',
          marginBottom: '2rem',
        }}
      >
        {/* Net Balance */}
        <div style={{ padding: '1.25rem 1.5rem', borderRight: '1px solid #E5E5E5' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            Net Balance
          </p>
          <p
            className="mono"
            style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', lineHeight: 1, margin: 0 }}
          >
            {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
          </p>
        </div>

        {/* You are owed */}
        <div style={{ padding: '1.25rem 1.5rem', borderRight: '1px solid #E5E5E5' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            You Are Owed
          </p>
          <p
            className="mono"
            style={{ fontSize: '2rem', fontWeight: 700, color: '#16A34A', lineHeight: 1, margin: 0 }}
          >
            {formatCurrency(stats.totalOwed)}
          </p>
        </div>

        {/* You owe */}
        <div style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            You Owe
          </p>
          <p
            className="mono"
            style={{ fontSize: '2rem', fontWeight: 700, color: '#DC2626', lineHeight: 1, margin: 0 }}
          >
            {formatCurrency(stats.totalOwing)}
          </p>
        </div>
      </div>

      {/* ── Main grid ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem', marginBottom: '1.5rem' }}>

        {/* Settle up */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>Settle up</h2>
            <Link to="/balances" className="link-mono">
              View all →
            </Link>
          </div>

          {stats.myDebts.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center' }}>
              <p style={{ color: '#16A34A', fontSize: '0.875rem', fontWeight: 500 }}>✓ All settled up</p>
            </div>
          ) : (
            <div>
              {stats.myDebts.slice(0, 4).map((debt, i) => {
                const name = debt.from === user?.id ? debt.toName : debt.fromName;
                const isHovered = hoveredDebt === i;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHoveredDebt(i)}
                    onMouseLeave={() => setHoveredDebt(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 0.5rem',
                      borderLeft: isHovered ? '2px solid #16A34A' : '2px solid transparent',
                      background: isHovered ? '#F9FAFB' : 'transparent',
                      transition: 'all 0.1s',
                      cursor: 'default',
                    }}
                  >
                    {/* Monogram square */}
                    <div className="monogram monogram-lg">
                      {getInitials(name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {debt.from === user?.id ? (
                        <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>
                          You owe <span style={{ fontWeight: 600, color: '#111827' }}>{debt.toName}</span>
                        </p>
                      ) : (
                        <p style={{ fontSize: '0.8125rem', color: '#374151', margin: 0 }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{debt.fromName}</span> owes you
                        </p>
                      )}
                    </div>
                    <span
                      className="mono"
                      style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', flexShrink: 0 }}
                    >
                      {formatCurrency(debt.amount)}
                    </span>
                    {isHovered && (
                      <Link
                        to={`/groups/${groups[0]?.id}`}
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.65rem',
                          color: '#16A34A',
                          textDecoration: 'none',
                          flexShrink: 0,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Settle →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Groups */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>Groups</h2>
            <Link to="/groups" className="link-mono">Manage →</Link>
          </div>

          {groups.length === 0 ? (
            <div style={{ padding: '1.5rem 0', textAlign: 'center' }}>
              <Users className="w-7 h-7 mx-auto mb-2" style={{ color: '#D1D5DB' }} />
              <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: '0.75rem' }}>No groups yet</p>
              <Link to="/groups/new" className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>
                Create group
              </Link>
            </div>
          ) : (
            <div>
              {groups.map((g) => {
                const total = expenses
                  .filter((e) => e.groupId === g.id && !e.isSettlement)
                  .reduce((s, e) => s + e.amountInr, 0);
                const activeMembers = g.members.filter((m) => !m.leftAt).length;
                return (
                  <Link
                    key={g.id}
                    to={`/groups/${g.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      padding: '0.5rem 0',
                      textDecoration: 'none',
                      borderBottom: '1px solid #F3F4F6',
                    }}
                  >
                    <div
                      style={{
                        width: '28px', height: '28px',
                        border: '1px solid #E5E7EB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '0.7rem', fontWeight: 700,
                        color: '#374151', flexShrink: 0,
                      }}
                    >
                      {g.name[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                        {g.name}
                      </p>
                      <p style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: 0 }}>
                        {activeMembers} members
                      </p>
                    </div>
                    <span className="mono" style={{ fontSize: '0.75rem', color: '#374151', flexShrink: 0 }}>
                      {formatCurrency(total)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Expenses ───────────────────────────────── */}
      <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', margin: 0 }}>Recent Expenses</h2>
          <Link to="/expenses" className="link-mono">View all →</Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <Receipt style={{ width: '2rem', height: '2rem', color: '#E5E7EB', margin: '0 auto 0.75rem' }} />
            <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginBottom: '0.75rem' }}>No expenses yet</p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <Link to="/expenses/new" className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>
                <Plus className="w-3 h-3" /> Add expense
              </Link>
              <Link to="/import" className="btn-secondary" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem' }}>
                <Upload className="w-3 h-3" /> Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <div>
            {recentExpenses.map((e, idx) => {
              const group = groups.find((g) => g.id === e.groupId);
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 0',
                    borderBottom: idx < recentExpenses.length - 1 ? '1px solid #F3F4F6' : 'none',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {e.description}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: '#9CA3AF', margin: 0 }}>
                      {group?.name} · {e.paidByName} · {formatDate(e.date)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {formatCurrency(e.amountInr)}
                    </span>
                    {e.currency !== 'INR' && (
                      <p style={{ fontSize: '0.65rem', color: '#D97706', margin: 0 }}>
                        {e.currency} {e.amount}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
