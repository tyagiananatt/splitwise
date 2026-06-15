import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { validateCredentials, getAllUsers } from '../lib/userRegistry';
import toast from 'react-hot-toast';

// Pre-seed the demo group once — uses the stable hardcoded IDs from userRegistry
function seedDemoGroup(store: ReturnType<typeof useAppStore.getState>) {
  if (store.groups.find((g) => g.name === 'The Flat')) return;
  store.addGroup({
    name: 'The Flat',
    description: 'Aisha, Rohan, Priya, Meera (left Mar 31), Sam (joined Apr 15)',
    currency: 'INR',
    members: [
      { userId: 'user-aisha', name: 'Aisha', email: 'aisha@flat.com', joinedAt: '2024-02-01T00:00:00.000Z', leftAt: null,              role: 'admin'  },
      { userId: 'user-rohan', name: 'Rohan', email: 'rohan@flat.com', joinedAt: '2024-02-01T00:00:00.000Z', leftAt: null,              role: 'member' },
      { userId: 'user-priya', name: 'Priya', email: 'priya@flat.com', joinedAt: '2024-02-01T00:00:00.000Z', leftAt: null,              role: 'member' },
      { userId: 'user-meera', name: 'Meera', email: 'meera@flat.com', joinedAt: '2024-02-01T00:00:00.000Z', leftAt: '2024-03-31T00:00:00.000Z', role: 'member' },
      { userId: 'user-sam',   name: 'Sam',   email: 'sam@flat.com',   joinedAt: '2024-04-15T00:00:00.000Z', leftAt: null,              role: 'member' },
    ],
  });
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]       = useState(false);

  const doLogin = (id: string, name: string, email: string) => {
    login({ id, name, email, createdAt: new Date().toISOString() });
    seedDemoGroup(useAppStore.getState());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));

    const found = validateCredentials(email.trim(), password);
    if (!found) {
      toast.error('Invalid email or password');
      setLoading(false);
      return;
    }

    doLogin(found.id, found.name, found.email);
    toast.success(`Welcome back, ${found.name}!`);
    navigate('/dashboard');
    setLoading(false);
  };

  const handleDemoLogin = async (id: string, name: string, demoEmail: string) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 200));
    doLogin(id, name, demoEmail);
    toast.success(`Signed in as ${name}`);
    navigate('/dashboard');
    setLoading(false);
  };

  // Only the 6 demo accounts for the quick-login grid
  const demoUsers = getAllUsers().filter((u) => u.id.startsWith('user-'));

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '48px', height: '48px',
            background: '#0F1117',
            marginBottom: '0.75rem',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.25rem', color: '#4ADE80', fontWeight: 700 }}>₹</span>
          </div>
          <h1 style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>SplitWise</h1>
          <p style={{ fontSize: '0.8rem', color: '#9CA3AF', marginTop: '0.25rem' }}>Split expenses, settle debts</p>
        </div>

        {/* Card */}
        <div className="card animate-fade-in">
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1.25rem', marginTop: 0 }}>Sign in</h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
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
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
              Sign in
            </button>
          </form>

          <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#9CA3AF' }}>
            No account?{' '}
            <Link to="/register" style={{ color: '#16A34A', fontWeight: 500, textDecoration: 'none' }}>Create one</Link>
          </p>
        </div>

        {/* Demo accounts */}
        <div className="card animate-fade-in" style={{ marginTop: '0.75rem' }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem', marginTop: 0 }}>
            Demo accounts — password: password123
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {demoUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => handleDemoLogin(u.id, u.name, u.email)}
                disabled={loading}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                  padding: '0.5rem', border: '1px solid #E5E7EB', background: 'white',
                  cursor: 'pointer', borderRadius: '0.375rem', transition: 'border-color 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#16A34A')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#E5E7EB')}
              >
                <div style={{
                  width: '28px', height: '28px', border: '1px solid #D1D5DB', background: '#F9FAFB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.65rem', fontWeight: 700, color: '#111827',
                }}>
                  {u.name[0]}
                </div>
                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#374151' }}>{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
