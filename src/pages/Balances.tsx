import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { calculateBalances, simplifyDebts } from '../lib/balances';
import { formatCurrency, formatDate, getInitials } from '../lib/utils';

export default function Balances() {
  const { getGroupsForUser, expenses, settlements } = useAppStore();
  const { user } = useAuthStore();

  const groups = user ? getGroupsForUser(user.id) : [];
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#9CA3AF' }}>Create a group first to see balances.</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <h1 className="page-title">Balances</h1>
        <select className="input" style={{ width: 'auto', fontSize: '0.8rem' }} value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {group && (
        <>
          {/* ── Balance table (replaces card grid) ─────────── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  {['Person', 'Status', 'Total Paid', 'Total Owes', 'Net'].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: '0.625rem 1rem',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: '#9CA3AF',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        textAlign: i >= 2 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                  <th style={{ padding: '0.625rem 1rem', width: '2rem' }} />
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => {
                  const isExpanded = expandedUser === b.userId;
                  const status = b.net > 0.01 ? 'owed' : b.net < -0.01 ? 'owes' : 'settled';
                  return (
                    <>
                      <tr
                        key={b.userId}
                        style={{
                          borderBottom: '1px solid #F3F4F6',
                          background: isExpanded ? '#FAFAFA' : 'white',
                          cursor: 'pointer',
                        }}
                        onClick={() => setExpandedUser(isExpanded ? null : b.userId)}
                      >
                        {/* Person */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <div className="monogram monogram-lg">
                              {getInitials(b.userName)}
                            </div>
                            <span style={{ fontWeight: 500, color: '#111827' }}>{b.userName}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: '#9CA3AF',
                              fontFamily: 'inherit',
                            }}
                          >
                            {status}
                          </span>
                        </td>

                        {/* Total Paid */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: '0.8rem', color: '#374151' }}>
                            {formatCurrency(b.totalPaid)}
                          </span>
                        </td>

                        {/* Total Owes */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <span className="mono" style={{ fontSize: '0.8rem', color: '#374151' }}>
                            {formatCurrency(b.totalOwed)}
                          </span>
                        </td>

                        {/* Net — color coded */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                          <span
                            className="mono"
                            style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: b.net > 0.01 ? '#16A34A' : b.net < -0.01 ? '#DC2626' : '#9CA3AF',
                            }}
                          >
                            {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                          </span>
                        </td>

                        {/* Expand toggle */}
                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                          {isExpanded
                            ? <ChevronDown style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                            : <ChevronRight style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                          }
                        </td>
                      </tr>

                      {/* Expanded breakdown */}
                      {isExpanded && b.expenseBreakdown.length > 0 && (
                        <tr key={`${b.userId}-detail`} style={{ background: '#FAFAFA' }}>
                          <td colSpan={6} style={{ padding: '0 1rem 0.75rem 3.5rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                                  <th style={{ padding: '0.375rem 0.5rem 0.375rem 0', textAlign: 'left', color: '#9CA3AF', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Expense</th>
                                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'right', color: '#9CA3AF', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Date</th>
                                  <th style={{ padding: '0.375rem 0.5rem', textAlign: 'right', color: '#9CA3AF', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Paid</th>
                                  <th style={{ padding: '0.375rem 0 0.375rem 0.5rem', textAlign: 'right', color: '#9CA3AF', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Share</th>
                                </tr>
                              </thead>
                              <tbody>
                                {b.expenseBreakdown.map((item) => (
                                  <tr key={item.expenseId} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                    <td style={{ padding: '0.375rem 0.5rem 0.375rem 0', color: '#374151' }}>{item.description}</td>
                                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right', color: '#9CA3AF' }}>{formatDate(item.date)}</td>
                                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>
                                      <span className="mono" style={{ color: item.youPaid > 0 ? '#16A34A' : '#D1D5DB' }}>
                                        {item.youPaid > 0 ? formatCurrency(item.youPaid) : '—'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.375rem 0 0.375rem 0.5rem', textAlign: 'right' }}>
                                      <span className="mono" style={{ color: '#DC2626' }}>{formatCurrency(item.yourShare)}</span>
                                    </td>
                                  </tr>
                                ))}
                                <tr>
                                  <td colSpan={3} style={{ padding: '0.5rem 0.5rem 0.25rem 0', fontWeight: 600, color: '#374151', fontSize: '0.7rem' }}>
                                    Net
                                  </td>
                                  <td style={{ padding: '0.5rem 0 0.25rem 0.5rem', textAlign: 'right' }}>
                                    <span className="mono" style={{ fontWeight: 700, color: b.net > 0.01 ? '#16A34A' : b.net < -0.01 ? '#DC2626' : '#9CA3AF' }}>
                                      {b.net > 0.01 ? '+' : ''}{formatCurrency(b.net)}
                                    </span>
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Minimum payments section ────────────────────── */}
          <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden' }}>
            {/* Section header */}
            <div style={{ borderBottom: '1px solid #E5E7EB', padding: '0.875rem 1rem' }}>
              <p style={{
                fontSize: '0.625rem',
                fontWeight: 700,
                color: '#9CA3AF',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                margin: 0,
              }}>
                Minimum Payments to Settle Up
              </p>
            </div>

            {debts.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: '#16A34A', fontWeight: 500, fontSize: '0.875rem', margin: 0 }}>
                  ✓ All settled up
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <tbody>
                  {debts.map((d, i) => (
                    <tr
                      key={i}
                      style={{ borderBottom: i < debts.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                    >
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="monogram monogram-lg">{getInitials(d.fromName)}</div>
                          <span style={{ fontWeight: 500, color: '#DC2626' }}>{d.fromName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', color: '#9CA3AF', fontSize: '0.75rem' }}>
                        pays
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div className="monogram monogram-lg">{getInitials(d.toName)}</div>
                          <span style={{ fontWeight: 500, color: '#16A34A' }}>{d.toName}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <span className="mono" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                          {formatCurrency(d.amount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
