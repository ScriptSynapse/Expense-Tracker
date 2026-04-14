/**
 * pages/ExpensesPage.jsx — Full expense list with filters, edit, delete, export
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Filter, Download, Edit2, Trash2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { expenseAPI, categoryAPI } from '../services/api';
import { format } from 'date-fns';
import AddExpenseModal from '../components/expenses/AddExpenseModal';

const CATEGORY_COLORS = {
  'Food & Dining': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Transport': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Shopping': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Entertainment': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Bills & Utilities': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Health & Medical': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'Travel': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Education': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'default': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const CategoryBadge = ({ category }) => {
  const cls = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  return <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>{category}</span>;
};

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    page: 1,
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
      const res = await expenseAPI.list(params);
      setExpenses(res.data.expenses || []);
      setPagination(res.data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { categoryAPI.list().then(r => setCategories(r.data.categories || [])); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    await expenseAPI.delete(id);
    loadExpenses();
  };

  const handleFilterChange = (key, val) => {
    setFilters(f => ({ ...f, [key]: val, page: 1 }));
  };

  const exportCSV = () => {
    const headers = ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Notes', 'AI Category', 'Confidence'];
    const rows = expenses.map(e => [
      format(new Date(e.date), 'yyyy-MM-dd'),
      `"${e.description}"`,
      e.category,
      e.amount,
      e.currency,
      `"${e.notes || ''}"`,
      e.aiCategory || '',
      e.aiConfidence ? `${(e.aiConfidence * 100).toFixed(0)}%` : '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{pagination.total} total records</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={() => { setEditingExpense(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search description, notes..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              showFilters ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-800">
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)}
              placeholder="From"
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)}
              placeholder="To"
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                setFilters(f => ({ ...f, sortBy, sortOrder, page: 1 }));
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="amount-desc">Highest amount</option>
              <option value="amount-asc">Lowest amount</option>
            </select>
          </div>
        )}
      </div>

      {/* Expense table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <p className="text-sm">No expenses found</p>
            <button onClick={() => setShowModal(true)} className="mt-2 text-blue-600 text-sm hover:underline">
              Add your first expense →
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    {['Date', 'Description', 'Category', 'Amount', 'Source', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {expenses.map((expense) => (
                    <tr key={expense._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {format(new Date(expense.date), 'dd MMM yyyy')}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">{expense.description}</p>
                        {expense.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{expense.notes}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <CategoryBadge category={expense.category} />
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {expense.currency} {expense.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {expense.categorySource === 'ai' && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Sparkles className="w-3 h-3" />
                            AI ({Math.round((expense.aiConfidence || 0) * 100)}%)
                          </span>
                        )}
                        {expense.categorySource === 'corrected' && (
                          <span className="text-xs text-amber-600 dark:text-amber-400">Corrected</span>
                        )}
                        {expense.categorySource === 'manual' && (
                          <span className="text-xs text-gray-400">Manual</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingExpense(expense); setShowModal(true); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(expense._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-500">
                  Showing {((filters.page - 1) * 20) + 1}–{Math.min(filters.page * 20, pagination.total)} of {pagination.total}
                </p>
                <div className="flex gap-1">
                  <button
                    disabled={filters.page === 1}
                    onClick={() => handleFilterChange('page', filters.page - 1)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400">
                    {filters.page} / {pagination.pages}
                  </span>
                  <button
                    disabled={filters.page === pagination.pages}
                    onClick={() => handleFilterChange('page', filters.page + 1)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <AddExpenseModal
          initialData={editingExpense}
          onClose={() => { setShowModal(false); setEditingExpense(null); }}
          onSuccess={() => { setShowModal(false); setEditingExpense(null); loadExpenses(); }}
        />
      )}
    </div>
  );
}
