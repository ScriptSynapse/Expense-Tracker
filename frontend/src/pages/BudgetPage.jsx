/**
 * pages/BudgetPage.jsx — Set and track monthly budgets per category
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { budgetAPI, categoryAPI } from '../services/api';

const now = new Date();

export default function BudgetPage() {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: '', amount: '', alertThreshold: 80 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, catRes] = await Promise.all([
        budgetAPI.list({ month, year }),
        categoryAPI.list(),
      ]);
      setBudgets(budgetRes.data.budgets || []);
      setCategories(catRes.data.categories || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { loadBudgets(); }, [loadBudgets]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await budgetAPI.create({ ...form, amount: parseFloat(form.amount), month, year });
      setShowForm(false);
      setForm({ category: '', amount: '', alertThreshold: 80 });
      loadBudgets();
    } catch (err) {
      setError(err.error || 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this budget?')) return;
    await budgetAPI.delete(id);
    loadBudgets();
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);
  const overBudget = budgets.filter(b => b.percentage >= 100).length;
  const nearLimit = budgets.filter(b => b.percentage >= b.alertThreshold && b.percentage < 100).length;

  const usedCategories = new Set(budgets.map(b => b.category));
  const availableCategories = categories.filter(c => !usedCategories.has(c));

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Budget</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Set monthly spending limits by category</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Set budget
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2">
        <select
          value={month}
          onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total budget', value: `$${totalBudget.toFixed(2)}`, color: 'text-blue-600' },
          { label: 'Total spent', value: `$${totalSpent.toFixed(2)}`, color: 'text-gray-900 dark:text-white' },
          { label: 'Remaining', value: `$${Math.max(0, totalBudget - totalSpent).toFixed(2)}`, color: 'text-green-600' },
          { label: 'Over budget', value: overBudget, color: overBudget > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
            <p className={`text-xl font-semibold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alerts banner */}
      {(overBudget > 0 || nearLimit > 0) && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          overBudget > 0
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${overBudget > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <p className={`text-sm ${overBudget > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {overBudget > 0
              ? `${overBudget} categor${overBudget > 1 ? 'ies have' : 'y has'} exceeded its budget this month.`
              : `${nearLimit} categor${nearLimit > 1 ? 'ies are' : 'y is'} approaching the spending limit.`}
          </p>
        </div>
      )}

      {/* Budget list */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : budgets.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-400 text-sm mb-2">No budgets set for this period</p>
          <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm hover:underline">
            Set your first budget →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((budget) => {
            const pct = Math.min(100, budget.percentage || 0);
            const isOver = pct >= 100;
            const isWarning = pct >= budget.alertThreshold && !isOver;
            const barColor = isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500';

            return (
              <div key={budget._id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">{budget.category}</h3>
                    {isOver && <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">Over budget</span>}
                    {isWarning && <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full">Near limit</span>}
                    {!isOver && !isWarning && pct < 50 && <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400"><CheckCircle className="w-3 h-3" /> On track</span>}
                  </div>
                  <button onClick={() => handleDelete(budget._id)} className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <span>${(budget.spent || 0).toFixed(2)} spent</span>
                  <span>${budget.amount.toFixed(2)} budget</span>
                </div>

                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs">
                  <span className={isOver ? 'text-red-500' : 'text-gray-400'}>
                    {pct.toFixed(1)}% used
                  </span>
                  <span className="text-gray-400">
                    {isOver
                      ? `$${(budget.spent - budget.amount).toFixed(2)} over`
                      : `$${(budget.remaining || 0).toFixed(2)} remaining`}
                  </span>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  Alert threshold: {budget.alertThreshold}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Budget Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-5">Set budget</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category *</label>
                <select
                  required
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select category</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monthly budget ($) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="500.00"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Alert threshold: <span className="text-blue-600 font-semibold">{form.alertThreshold}%</span>
                </label>
                <input
                  type="range"
                  min="50"
                  max="95"
                  step="5"
                  value={form.alertThreshold}
                  onChange={e => setForm(f => ({ ...f, alertThreshold: Number(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>50%</span><span>95%</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'Saving...' : 'Save budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
