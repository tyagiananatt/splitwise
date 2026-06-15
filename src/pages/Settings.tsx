import { useState } from 'react';
import { User, Save, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, logout, updateProfile } = useAuthStore();
  const { groups, expenses, settlements } = useAppStore();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');

  const handleSave = () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    updateProfile({ name: name.trim(), email: email.trim() });
    toast.success('Profile updated');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    toast.success('Logged out');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-600" /> Profile
        </h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button onClick={handleSave} className="btn-primary">
          <Save className="w-4 h-4" /> Save changes
        </button>
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-3">Your data</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xl font-bold text-gray-900">{groups.length}</p>
            <p className="text-xs text-gray-500">Groups</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xl font-bold text-gray-900">{expenses.length}</p>
            <p className="text-xs text-gray-500">Expenses</p>
          </div>
          <div className="p-3 bg-gray-50 rounded-xl">
            <p className="text-xl font-bold text-gray-900">{settlements.length}</p>
            <p className="text-xs text-gray-500">Settlements</p>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="card border-red-100">
        <h2 className="font-semibold text-red-700 flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5" /> Account
        </h2>
        <button onClick={handleLogout} className="btn-danger">
          Sign out
        </button>
      </div>
    </div>
  );
}
