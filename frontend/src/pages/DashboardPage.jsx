/**
 * pages/DashboardPage.jsx — Main dashboard with charts and summary
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Receipt, Plus, ArrowRight } from 'lucide-react';
import { expenseAPI, budgetAPI } from '../services/api';
import { useAuthStore } from '../store';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import AddExpenseModal from '../components/expenses/AddExpenseModal';

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
  '#ec4899', '#6366f1', '#14b8a6', '#eab308',
];

const StatCard = ({ title, value, subtitle, icon: Icon, trend }) => (
  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      </div>
    </div>
    <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
    {subtitle && (
      <p className={`text-xs mt-1 flex items-center gap-1 ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-gray-400'}`}>
        {trend === 'up' && <TrendingUp className="w-3 h-3" />}
        {trend === 'down' && <TrendingDown className="w-3 h-3" />}
        {subtitle}
      </p>
    )}
  </div>
);

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium text-gray-900 dark:text-white">{payload[0].name}</p>
      <p className="text-gray-600 dark:text-gray-400">${payload[0].value?.toFixed(2)}</p>
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [breakdown, setBreakdown] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [totalSpending, setTotalSpending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const now = new Date();
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const [breakdownRes, summaryRes, recentRes, budgetRes] = await Promise.all([
        expenseAPI.categoryBreakdown({ startDate: monthStart, endDate: monthEnd }),
        expenseAPI.monthlySummary({ year: now.getFullYear() }),
        expenseAPI.list({ page: 1, limit: 5, sortBy: 'date', sortOrder: 'desc' }),
        budgetAPI.list({ month: now.getMonth() + 1, year: now.getFullYear() }),
      ]);

      setBreakdown(breakdownRes.data.breakdown || []);
      setTotalSpending(breakdownRes.data.totalSpending || 0);
      setRecentExpenses(recentRes.data.expenses || []);
      setBudgets(budgetRes.data.budgets || []);

      // Build 6-month trend from summary
      const summaryData = summaryRes.data.summary || [];
      const trendMap = {};
      summaryData.forEach(({ _id, total }) => {
        const key = `${_id.year}-${String(_id.month).padStart(2, '0')}`;
        trendMap[key] = (trendMap[key] || 0) + total;
      });
      const trend = Array.from({ length: 6 }, (_, i) => {
        const d = subMonths(now, 5 - i);
        const key = format(d, 'yyyy-MM');
        return { month: format(d, 'MMM'), total: trendMap[key] || 0 };
      });
      setMonthlyTrend(trend);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
  const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

  const topCategory = breakdown[0]?.category || '—';
  const currentMonthName = format(now, 'MMMM');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Good {now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Here's your spending overview for {currentMonthName}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add expense
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Month's spending"
          value={`$${totalSpending.toFixed(2)}`}
          subtitle="vs last month"
          icon={DollarSign}
        />
        <StatCard
          title="Transactions"
          value={recentExpenses.length + (recentExpenses.length === 5 ? '+' : '')}
          subtitle="this month"
          icon={Receipt}
        />
        <StatCard
          title="Top category"
          value={topCategory}
          subtitle={breakdown[0] ? `$${breakdown[0].total.toFixed(2)}` : ''}
          icon={TrendingUp}
        />
        <StatCard
          title="Budget alerts"
          value={budgets.filter(b => b.percentage >= b.alertThreshold).length}
          subtitle="categories over threshold"
          icon={TrendingDown}
        />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category pie chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Spending by category</h2>
          {breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={breakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="total"
                  nameKey="category"
                >
                  {breakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-gray-400 text-sm">
              No expenses this month
            </div>
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-2">
            {breakdown.slice(0, 6).map((item, i) => (
              <div key={item.category} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                {item.category}
              </div>
            ))}
          </div>
        </div>

        {/* Monthly trend line chart */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">6-month trend</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Spending']} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent expenses + budget alerts */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent expenses */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent expenses</h2>
            <Link to="/expenses" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentExpenses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No expenses yet</p>
            ) : recentExpenses.map((exp) => (
              <div key={exp._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{exp.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{exp.category} · {format(new Date(exp.date), 'dd MMM')}</p>
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white ml-3">
                  ${exp.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Budget status */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Budget status</h2>
            <Link to="/budget" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Manage <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-4">
            {budgets.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">No budgets set</p>
                <Link to="/budget" className="text-xs text-blue-600 hover:underline mt-1 block">Set a budget →</Link>
              </div>
            ) : budgets.slice(0, 5).map((budget) => {
              const pct = Math.min(100, budget.percentage || 0);
              const isOver = pct >= 100;
              const isWarning = pct >= budget.alertThreshold;
              return (
                <div key={budget._id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{budget.category}</span>
                    <span className={isOver ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-gray-500 dark:text-gray-400'}>
                      ${budget.spent?.toFixed(2)} / ${budget.amount}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <AddExpenseModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); loadDashboard(); }}
        />
      )}
    </div>
  );
}
