import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { api, setStoredToken } from '../api.ts';
import { BrandLogo } from './BrandLogo.tsx';

interface AuthGateProps {
  onUnlocked: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onUnlocked }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your business password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.login(password);
      if (res.token) {
        setStoredToken(res.token);
      }
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-emerald-800/30 shadow-2xl p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <BrandLogo size="lg" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Sehat Ki Duniya</h1>
            <p className="text-base font-urdu font-semibold text-emerald-700">
              صحت کی دنیا
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Protected Accounting Workspace</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Enter your password to unlock daily entries, financial reports, and ledgers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="unlock-password"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Password · پاس ورڈ
            </label>
            <input
              id="unlock-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
            />
          </div>

          {error && (
            <div className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-ui disabled:opacity-60"
          >
            <span>{loading ? 'Verifying...' : 'Unlock System'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
