import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Users, Receipt, TrendingUp, TrendingDown, Upload, Plus, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { calculateBalances, simplifyDebts } from '../lib/balances';
import { formatCurrency, formatDate, getAvatarColor, getInitials } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { groups, expenses, settlements } = useAppStore();

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

    const myDebts = allDebts.filter((d) => d.from === user?.id || d.to === user?.id);
    return { totalOwed, totalOwing, myDebts };
  }, [groups, expenses, settlements, user]);

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .filter((e) => !e.isSettlement)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses]);

  const netBalance = stats.totalOwed - stats.totalOwing;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hey, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's your expense overview</p>
        </div>
        <Link to="/groups/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Group
        </Link>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-indigo-600 to-indigo-700 text-white border-0">
          <p className="text-indigo-200 text-sm font-medium">Net Balance</p>
          <p className={`text-3xl font-bold mt-1 ${netBalance >= 0 ? 'text-white' : 'text-red-200'}`}>
            {netBalance >= 0 ? '+' : ''}{formatCurrency(netBalance)}
          </p>
          <p className="text-indigo-200 text-xs mt-1">
            {netBalance >= 0 ? 'People owe you' : 'You owe people'}
          </p>
        </div>

        <div className="card border-green-100 bg-green-50">
          <p className="text-green-600 text-sm font-medium flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> You are owed
          </p>
          <p className="text-3xl font-bold mt-1 text-green-700">{formatCurrency(stats.totalOwed)}</p>
          <p className="text-green-500 text-xs mt-1">across all groups</p>
        </div>

        <div className="card border-red-100 bg-red-50">
          <p className="text-red-600 text-sm font-medium flex items-center gap-1">
            <TrendingDown className="w-4 h-4" /> You owe
          </p>
          <p className="text-3xl font-bold mt-1 text-red-700">{formatCurrency(stats.totalOwing)}</p>
          <p className="text-red-500 text-xs mt-1">across all groups</p>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Debts to settle */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Settle up</h2>
            <Link to="/balances" className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {stats.myDebts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-500 text-sm">You're all settled up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.myDebts.slice(0, 4).map((debt, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${getAvatarColor(debt.from === user?.id ? debt.toName : debt.fromName)}`}>
                    {getInitials(debt.from === user?.id ? debt.toName : debt.fromName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {debt.from === user?.id ? (
                      <p className="text-sm text-gray-900">
                        You owe <span className="font-semibold">{debt.toName}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-gray-900">
                        <span className="font-semibold">{debt.fromName}</span> owes you
                      </p>
                    )}
                  </div>
                  <span className={`font-semibold text-sm ${debt.from === user?.id ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(debt.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Groups */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Groups</h2>
            <Link to="/groups" className="text-indigo-600 text-sm font-medium hover:underline">
              Manage
            </Link>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">No groups yet</p>
              <Link to="/groups/new" className="mt-2 btn-primary text-xs px-3 py-1.5">
                Create group
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const groupExpenses = expenses.filter((e) => e.groupId === g.id && !e.isSettlement);
                const total = groupExpenses.reduce((s, e) => s + e.amountInr, 0);
                const activeMembers = g.members.filter((m) => !m.leftAt).length;
                return (
                  <Link
                    key={g.id}
                    to={`/groups/${g.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                      {g.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                      <p className="text-xs text-gray-500">{activeMembers} members · {formatCurrency(total)}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Expenses */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Recent Expenses</h2>
          <Link to="/expenses" className="text-indigo-600 text-sm font-medium flex items-center gap-1 hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="text-center py-8">
            <Receipt className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-3">No expenses yet</p>
            <div className="flex items-center justify-center gap-2">
              <Link to="/expenses/new" className="btn-primary text-xs px-3 py-1.5">
                <Plus className="w-3 h-3" /> Add expense
              </Link>
              <Link to="/import" className="btn-secondary text-xs px-3 py-1.5">
                <Upload className="w-3 h-3" /> Import CSV
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentExpenses.map((e) => {
              const group = groups.find((g) => g.id === e.groupId);
              return (
                <div key={e.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.description}</p>
                    <p className="text-xs text-gray-500">
                      {group?.name} · {e.paidByName} paid · {formatDate(e.date)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {e.currency !== 'INR' && (
                        <span className="text-xs text-gray-400 mr-1">{e.currency} {e.amount}</span>
                      )}
                      {formatCurrency(e.amountInr)}
                    </p>
                    {e.currency !== 'INR' && (
                      <p className="text-xs text-amber-600">converted</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { to: '/expenses/new', icon: Plus, label: 'Add Expense', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
          { to: '/groups/new', icon: Users, label: 'New Group', color: 'bg-purple-50 text-purple-700 hover:bg-purple-100' },
          { to: '/import', icon: Upload, label: 'Import CSV', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
          { to: '/balances', icon: TrendingUp, label: 'View Balances', color: 'bg-green-50 text-green-700 hover:bg-green-100' },
        ].map(({ to, icon: Icon, label, color }) => (
          <Link
            key={to}
            to={to}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors ${color}`}
          >
            <Icon className="w-6 h-6" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
