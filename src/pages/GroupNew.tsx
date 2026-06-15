import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Users } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface MemberInput {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
}

export default function GroupNew() {
  const navigate = useNavigate();
  const { addGroup } = useAppStore();
  const { user } = useAuthStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [members, setMembers] = useState<MemberInput[]>([
    { id: user?.id ?? uuidv4(), name: user?.name ?? '', email: user?.email ?? '', joinedAt: new Date().toISOString().split('T')[0] },
  ]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberDate, setNewMemberDate] = useState(new Date().toISOString().split('T')[0]);

  const addMember = () => {
    if (!newMemberName.trim()) return;
    setMembers([
      ...members,
      {
        id: uuidv4(),
        name: newMemberName.trim(),
        email: newMemberEmail.trim(),
        joinedAt: newMemberDate,
      },
    ]);
    setNewMemberName('');
    setNewMemberEmail('');
  };

  const removeMember = (id: string) => {
    if (id === user?.id) { toast.error("Can't remove yourself"); return; }
    setMembers(members.filter((m) => m.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Group name is required'); return; }
    if (members.length < 2) { toast.error('Add at least 2 members'); return; }

    const group = addGroup({
      name: name.trim(),
      description: description.trim(),
      currency,
      members: members.map((m) => ({
        userId: m.id,
        name: m.name,
        email: m.email,
        joinedAt: new Date(m.joinedAt).toISOString(),
        leftAt: null,
        role: m.id === user?.id ? 'admin' : 'member',
      })),
    });

    toast.success(`Group "${name}" created`);
    navigate(`/groups/${group.id}`);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Group</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Group details</h2>

          <div>
            <label className="label">Group name *</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. The Flat, Goa Trip"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Description</label>
            <input
              type="text"
              className="input"
              placeholder="Optional description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Default currency</label>
            <select className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="INR">INR — Indian Rupee</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
            </select>
          </div>
        </div>

        {/* Members */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Members</h2>
          </div>

          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {m.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">{m.email || 'No email'} · Joined {m.joinedAt}</p>
                </div>
                {m.id === user?.id && (
                  <span className="badge-blue text-xs">You</span>
                )}
                {m.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add member */}
          <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Add member</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-xs">Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="email@example.com"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="label text-xs">Joined date</label>
              <input
                type="date"
                className="input"
                value={newMemberDate}
                onChange={(e) => setNewMemberDate(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={addMember}
              disabled={!newMemberName.trim()}
              className="btn-secondary w-full justify-center"
            >
              <Plus className="w-4 h-4" /> Add member
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" className="btn-primary flex-1 justify-center">
            Create Group
          </button>
        </div>
      </form>
    </div>
  );
}
