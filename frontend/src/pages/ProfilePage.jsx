/**
 * pages/ProfilePage.jsx — User profile, preferences, password change
 */

import React, { useState } from 'react';
import { User, Lock, Bell, Palette, Loader2, CheckCircle } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuthStore, useThemeStore } from '../store';

const Section = ({ title, icon: Icon, children }) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center gap-2 mb-5">
      <Icon className="w-4 h-4 text-blue-600" />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
    </div>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const [profile, setProfile] = useState({ name: user?.name || '', currency: user?.preferences?.currency || 'USD' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await authAPI.updateProfile({
        name: profile.name,
        preferences: { currency: profile.currency, theme },
      });
      updateUser(res.data.user);
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.error || 'Failed to update profile.' });
    } finally {
      setProfileSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (password.newPassword !== password.confirmPassword) {
      return setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
    }
    if (password.newPassword.length < 8) {
      return setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
    }
    setPasswordSaving(true);
    try {
      await authAPI.changePassword({ currentPassword: password.currentPassword, newPassword: password.newPassword });
      setPassword({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.error || 'Failed to change password.' });
    } finally {
      setPasswordSaving(false);
    }
  };

  const Msg = ({ msg }) => msg ? (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm mt-3 ${
      msg.type === 'success'
        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'
    }`}>
      {msg.type === 'success' && <CheckCircle className="w-4 h-4" />}
      {msg.text}
    </div>
  ) : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Profile</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your account settings</p>
      </div>

      {/* Avatar + info */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-2xl font-semibold">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-white">{user?.name}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </p>
        </div>
      </div>

      {/* Profile form */}
      <Section title="Personal information" icon={User}>
        <form onSubmit={saveProfile} className="space-y-4">
          <Input
            label="Full name"
            type="text"
            value={profile.name}
            onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
          />
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email address</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Default currency</label>
            <select
              value={profile.currency}
              onChange={e => setProfile(p => ({ ...p, currency: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={profileSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {profileSaving ? 'Saving...' : 'Save changes'}
          </button>
          <Msg msg={profileMsg} />
        </form>
      </Section>

      {/* Theme */}
      <Section title="Appearance" icon={Palette}>
        <div className="flex gap-3">
          {[
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
            { value: 'system', label: 'System' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                theme === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                  : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Change password */}
      <Section title="Security" icon={Lock}>
        <form onSubmit={savePassword} className="space-y-4">
          <Input
            label="Current password"
            type="password"
            value={password.currentPassword}
            onChange={e => setPassword(p => ({ ...p, currentPassword: e.target.value }))}
            placeholder="••••••••"
            required
          />
          <Input
            label="New password"
            type="password"
            value={password.newPassword}
            onChange={e => setPassword(p => ({ ...p, newPassword: e.target.value }))}
            placeholder="Min. 8 characters"
            required
          />
          <Input
            label="Confirm new password"
            type="password"
            value={password.confirmPassword}
            onChange={e => setPassword(p => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Repeat new password"
            required
          />
          <button
            type="submit"
            disabled={passwordSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {passwordSaving ? 'Updating...' : 'Update password'}
          </button>
          <Msg msg={passwordMsg} />
        </form>
      </Section>
    </div>
  );
}
