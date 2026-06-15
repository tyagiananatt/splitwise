import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Trash2, ArrowRight, Search } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { formatCurrency, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function Groups() {
  const { groups, expenses, deleteGroup } = useAppStore();
  const [search, setSearch] = useState('');

  const filtered = groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete group "${name}"? All expenses will be removed.`)) return;
    deleteGroup(id);
    toast.success('Group deleted');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Groups</h1>
          <p className="text-gray-500 text-sm mt-0.5">{groups.length} group{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/groups/new" className="btn-primary">
          <Plus className="w-4 h-4" /> New Group
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          className="input pl-9"
          placeholder="Search groups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">
            {search ? 'No groups found' : 'No groups yet'}
          </h3>
          <p className="text-gray-500 text-sm mb-6">
            {search ? 'Try a different search term' : 'Create a group to start tracking shared expenses'}
          </p>
          {!search && (
            <Link to="/groups/new" className="btn-primary">
              <Plus className="w-4 h-4" /> Create your first group
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((g) => {
            const groupExpenses = expenses.filter((e) => e.groupId === g.id && !e.isSettlement);
            const total = groupExpenses.reduce((s, e) => s + e.amountInr, 0);
            const activeMembers = g.members.filter((m) => !m.leftAt);
            const formerMembers = g.members.filter((m) => m.leftAt);

            return (
              <div key={g.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-700 font-bold text-lg">
                      {g.name[0]}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{g.name}</h3>
                      {g.description && (
                        <p className="text-xs text-gray-500 line-clamp-1">{g.description}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(g.id, g.name)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Members */}
                <div className="flex -space-x-2 mb-3">
                  {activeMembers.slice(0, 6).map((m) => (
                    <div
                      key={m.userId}
                      title={m.name}
                      className="w-7 h-7 rounded-full bg-indigo-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                    >
                      {m.name[0]}
                    </div>
                  ))}
                  {activeMembers.length > 6 && (
                    <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-bold">
                      +{activeMembers.length - 6}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-gray-500">{activeMembers.length} active</span>
                    {formerMembers.length > 0 && (
                      <span className="text-gray-400 ml-1">· {formerMembers.length} former</span>
                    )}
                    <span className="text-gray-400 ml-1">· {groupExpenses.length} expenses</span>
                  </div>
                  <span className="font-semibold text-gray-900">{formatCurrency(total)}</span>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Created {formatDate(g.createdAt)}</span>
                  <Link
                    to={`/groups/${g.id}`}
                    className="flex items-center gap-1 text-indigo-600 text-sm font-medium hover:underline"
                  >
                    Open <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
