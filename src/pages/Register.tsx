import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { getUserByEmail, registerUser } from '../lib/userRegistry';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

export default function Register() {
  const navigate  = useNavigate();
  const { login } = useAuthStore();
  const { groups, relinkMember } = useAppStore();

  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));

    const existing = getUserByEmail(email.trim());
    if (existing) {
      toast.error('An account with this email already exists. Sign in instead.');
      setLoading(false);
      return;
    }

    const newUser = {
      id: uuidv4(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    };

    // Persist to registry
    registerUser(newUser);

    // ── Key fix: link any group-member slots that have this email ──────────
    // If someone added this person to a group before they registered,
    // their member slot has a placeholder ID. We patch it to newUser.id so
    // balances — including all existing expense shares — flow correctly.
    const lowerEmail = newUser.email;
    const linkedGroups: string[] = [];

    for (const group of groups) {
      const matchingMember = group.members.find(
        (m) => m.email.toLowerCase() === lowerEmail && m.userId !== newUser.id
      );
      if (matchingMember) {
        // relinkMember patches: group members + expense paidBy + shares + settlements
        relinkMember(matchingMember.userId, newUser);
        linkedGroups.push(group.name);
      }
    }

    if (linkedGroups.length > 0) {
      toast.success(`Linked to group${linkedGroups.length > 1 ? 's' : ''}: ${linkedGroups.join(', ')}`);
    }

    login({ id: newUser.id, name: newUser.name, email: newUser.email, createdAt: new Date().toISOString() });
    toast.success(`Welcome, ${newUser.name}!`);
    navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px', background: '#0F1117', marginBottom: '0.75rem',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.25rem', color: '#4ADE80', fontWeight: 700 }}>₹</span>
          </div>
          <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>SplitWise</h1>
          <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.25rem' }}>Split expenses, settle debts</p>
        </div>

        <div className="card animate-fade-in">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1.25rem', marginTop: 0 }}>Create account</h2>

          {/* Info box explaining linking */}
          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.375rem', padding: '0.625rem 0.75rem', marginBottom: '1rem', fontSize: '0.75rem', color: '#166534' }}>
            <strong>If you've been added to a group already</strong>, register with the same email address and your account will be automatically linked — your balances will appear immediately.
          </div>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label className="label">Full name</label>
              <input type="text" className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  style={{ paddingRight: '2.5rem' }}
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF' }}
                >
                  {showPassword ? <EyeOff style={{ width: '15px', height: '15px' }} /> : <Eye style={{ width: '15px', height: '15px' }} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary" style={{ justifyContent: 'center', padding: '0.625rem', marginTop: '0.25rem' }}>
              {loading && <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />}
              Create account
            </button>
          </form>

          <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#9CA3AF' }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: '#16A34A', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
