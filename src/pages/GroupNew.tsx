import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, X, Users } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { getUserByEmail } from '../lib/userRegistry';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface MemberInput {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  linked: boolean; // true if this email matched a registered account
}

export default function GroupNew() {
  const navigate    = useNavigate();
  const { addGroup } = useAppStore();
  const { user }    = useAuthStore();

  const [name, setName]         = useState('');
  const [description, setDescription] = useState('');
  const [currency, setCurrency] = useState('INR');

  const [members, setMembers] = useState<MemberInput[]>([
    {
      id: user?.id ?? uuidv4(),
      name: user?.name ?? '',
      email: user?.email ?? '',
      joinedAt: new Date().toISOString().split('T')[0],
      linked: true,
    },
  ]);

  const [newName, setNewName]   = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDate, setNewDate]   = useState(new Date().toISOString().split('T')[0]);

  const addMember = () => {
    if (!newName.trim()) { toast.error('Name is required'); return; }

    // Try to find a registered account for this email
    const registered = newEmail.trim() ? getUserByEmail(newEmail.trim()) : null;

    if (registered) {
      // Check if already in the list
      if (members.some((m) => m.id === registered.id)) {
        toast.error(`${registered.name} is already in this group`);
        return;
      }
      // Use their real account ID — balances will flow correctly immediately
      setMembers([...members, {
        id: registered.id,
        name: registered.name,      // use their registered name
        email: registered.email,
        joinedAt: newDate,
        linked: true,
      }]);
      toast.success(`Linked to ${registered.name}'s account`);
    } else {
      // No account yet — create a placeholder with a new UUID.
      // When they register with this email, Register.tsx will patch the UUID.
      const placeholder = newEmail.trim()
        ? `placeholder-${newEmail.trim().toLowerCase()}`
        : uuidv4();

      if (members.some((m) => m.id === placeholder)) {
        toast.error('This person is already in the list');
        return;
      }
      setMembers([...members, {
        id: placeholder,
        name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        joinedAt: newDate,
        linked: false,
      }]);
    }

    setNewName('');
    setNewEmail('');
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
    <div style={{ padding: '1.5rem', maxWidth: '640px', margin: '0 auto' }} className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ padding: '0.5rem', background: 'white', border: '1px solid #E5E7EB', borderRadius: '0.375rem', cursor: 'pointer' }}
        >
          <ArrowLeft style={{ width: '16px', height: '16px' }} />
        </button>
        <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', margin: 0 }}>New Group</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Group details */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', margin: 0 }}>Group details</h2>

          <div>
            <label className="label">Group name *</label>
            <input className="input" placeholder="e.g. The Flat, Goa Trip" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
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
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users style={{ width: '16px', height: '16px', color: '#16A34A' }} />
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', margin: 0 }}>Members</h2>
          </div>

          {/* Info */}
          <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', fontSize: '0.75rem', color: '#6B7280' }}>
            If you enter an email that's already registered, the member is automatically linked to their account and their balance is immediately live.
            If they haven't registered yet, enter their email anyway — when they sign up, they'll be linked automatically.
          </div>

          {/* Member list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  background: m.linked ? '#F0FDF4' : '#FFFBEB',
                  border: `1px solid ${m.linked ? '#BBF7D0' : '#FDE68A'}`,
                  borderRadius: '0.375rem',
                }}
              >
                <div style={{
                  width: '28px', height: '28px', flexShrink: 0,
                  border: '1px solid #D1D5DB', background: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: '#111827',
                }}>
                  {m.name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: '#111827' }}>{m.name}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#9CA3AF' }}>
                    {m.email || 'no email'} · Joined {m.joinedAt}
                    {m.linked
                      ? <span style={{ color: '#16A34A', marginLeft: '0.375rem', fontWeight: 500 }}>✓ linked</span>
                      : <span style={{ color: '#D97706', marginLeft: '0.375rem' }}>⏳ pending account</span>
                    }
                  </p>
                </div>
                {m.id === user?.id
                  ? <span className="badge-blue" style={{ fontSize: '0.65rem' }}>You</span>
                  : (
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D1D5DB', padding: '0.25rem', flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#D1D5DB')}
                    >
                      <X style={{ width: '14px', height: '14px' }} />
                    </button>
                  )
                }
              </div>
            ))}
          </div>

          {/* Add member form */}
          <div style={{ border: '1px dashed #E5E7EB', borderRadius: '0.375rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 500, color: '#374151', margin: 0 }}>Add member</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div>
                <label className="label" style={{ fontSize: '0.7rem' }}>Name *</label>
                <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="label" style={{ fontSize: '0.7rem' }}>Email (for linking)</label>
                <input className="input" type="email" placeholder="their@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label" style={{ fontSize: '0.7rem' }}>Joined date</label>
              <input className="input" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <button type="button" onClick={addMember} disabled={!newName.trim()} className="btn-secondary" style={{ justifyContent: 'center' }}>
              <Plus style={{ width: '14px', height: '14px' }} /> Add member
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            Create Group
          </button>
        </div>
      </form>
    </div>
  );
}
