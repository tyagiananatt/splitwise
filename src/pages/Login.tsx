import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Receipt, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';

// Demo users seeded for the flatmates scenario
const DEMO_USERS = [
  { id: 'user-aisha', name: 'Aisha', email: 'aisha@flat.com', password: 'password123' },
  { id: 'user-rohan', name: 'Rohan', email: 'rohan@flat.com', password: 'password123' },
  { id: 'user-priya', name: 'Priya', email: 'priya@flat.com', password: 'password123' },
  { id: 'user-meera', name: 'Meera', email: 'meera@flat.com', password: 'password123' },
  { id: 'user-sam', name: 'Sam', email: 'sam@flat.com', password: 'password123' },
  { id: 'user-dev', name: 'Dev', email: 'dev@flat.com', password: 'password123' },
];

// Pre-seed the demo group on first login of Aisha
function seedDemoGroup(store: ReturnType<typeof useAppStore.getState>) {
  if (store.groups.find((g) => g.name === 'The Flat')) return; // already seeded

  store.addGroup({
    name: 'The Flat',
    description: 'Aisha, Rohan, Priya, Meera (left Mar 31), Sam (joined Apr 15)',
    currency: 'INR',
    members: [
      { userId: 'user-aisha', name: 'Aisha', email: 'aisha@flat.com', joinedAt: '2024-02-01', leftAt: null, role: 'admin' },
      { userId: 'user-rohan', name: 'Rohan', email: 'rohan@flat.com', joinedAt: '2024-02-01', leftAt: null, role: 'member' },
      { userId: 'user-priya', name: 'Priya', email: 'priya@flat.com', joinedAt: '2024-02-01', leftAt: null, role: 'member' },
      { userId: 'user-meera', name: 'Meera', email: 'meera@flat.com', joinedAt: '2024-02-01', leftAt: '2024-03-31', role: 'member' },
      { userId: 'user-sam', name: 'Sam', email: 'sam@flat.com', joinedAt: '2024-04-15', leftAt: null, role: 'member' },
    ],
  });
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 400)); // simulate network

    const found = DEMO_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );

    if (!found) {
      toast.error('Invalid email or password');
      setLoading(false);
      return;
    }

    login({ id: found.id, name: found.name, email: found.email, createdAt: new Date().toISOString() });

    // Seed demo group for first-time login
    seedDemoGroup(useAppStore.getState());

    toast.success(`Welcome back, ${found.name}!`);
    navigate('/dashboard');
    setLoading(false);
  };

  const handleDemoLogin = async (demoUser: typeof DEMO_USERS[0]) => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 300));
    login({ id: demoUser.id, name: demoUser.name, email: demoUser.email, createdAt: new Date().toISOString() });
    seedDemoGroup(useAppStore.getState());
    toast.success(`Logged in as ${demoUser.name}`);
    navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg shadow-indigo-200">
            <Receipt className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">SplitWise</h1>
          <p className="text-gray-500 mt-1">Split expenses, settle debts</p>
        </div>

        {/* Login Card */}
        <div className="card animate-fade-in">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Sign in
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium hover:underline">
              Create one
            </Link>
          </div>
        </div>

        {/* Demo accounts */}
        <div className="mt-4 card animate-fade-in">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Demo accounts (password: password123)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                onClick={() => handleDemoLogin(u)}
                disabled={loading}
                className="flex flex-col items-center gap-1 p-2 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 transition-colors text-center disabled:opacity-50"
              >
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-xs font-bold">
                  {u.name[0]}
                </div>
                <span className="text-xs font-medium text-gray-700">{u.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
