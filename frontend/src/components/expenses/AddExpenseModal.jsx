/**
 * components/expenses/AddExpenseModal.jsx
 * Add/Edit expense with live AI categorization preview
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader2, Upload, Mic, MicOff } from 'lucide-react';
import { expenseAPI, categoryAPI } from '../../services/api';

const INITIAL_FORM = {
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  category: '',
  notes: '',
  tags: '',
  isRecurring: false,
  currency: 'USD',
};

export default function AddExpenseModal({ onClose, onSuccess, initialData = null }) {
  const [form, setForm] = useState(initialData ? { ...initialData, date: initialData.date?.split('T')[0] } : INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [listening, setListening] = useState(false);
  const descTimerRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    categoryAPI.list().then(res => setCategories(res.data.categories || []));
  }, []);

  // Auto-categorize after user stops typing (500ms debounce)
  useEffect(() => {
    if (!form.description || form.description.length < 3) return;
    clearTimeout(descTimerRef.current);
    descTimerRef.current = setTimeout(() => {
      if (!form.category) previewCategorize();
    }, 500);
    return () => clearTimeout(descTimerRef.current);
  }, [form.description, form.amount]);

  const previewCategorize = async () => {
    setAiLoading(true);
    try {
      const res = await expenseAPI.categorize({
        description: form.description,
        amount: parseFloat(form.amount) || undefined,
      });
      setAiSuggestion(res.data);
    } catch { /* silent */ }
    finally { setAiLoading(false); }
  };

  const applyAiSuggestion = () => {
    if (aiSuggestion) {
      setForm(f => ({ ...f, category: aiSuggestion.category }));
      setAiSuggestion(null);
    }
  };

  // Voice input via Web Speech API
  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Voice input not supported in this browser.');
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      // Parse "Uber ride 250" → description + amount
      const amountMatch = transcript.match(/\d+(\.\d+)?/);
      const cleanDesc = transcript.replace(/\d+(\.\d+)?/, '').trim();
      setForm(f => ({
        ...f,
        description: cleanDesc || transcript,
        amount: amountMatch ? amountMatch[0] : f.amount,
      }));
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    setListening(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let data;
      if (receiptFile) {
        data = new FormData();
        Object.entries(form).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) data.append(k, v);
        });
        data.append('receipt', receiptFile);
      } else {
        data = {
          ...form,
          amount: parseFloat(form.amount),
          tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        };
        if (!data.category) delete data.category; // Let AI decide
      }

      if (initialData?._id) {
        await expenseAPI.update(initialData._id, data);
      } else {
        await expenseAPI.create(data);
      }
      onSuccess();
    } catch (err) {
      setError(err.error || 'Failed to save expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {initialData ? 'Edit expense' : 'Add expense'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Amount + Currency */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amount}
                onChange={(e) => handleField('amount', e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => handleField('currency', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description + Voice */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description *</label>
            <div className="relative">
              <input
                type="text"
                required
                value={form.description}
                onChange={(e) => handleField('description', e.target.value)}
                placeholder='e.g. "Uber ride 250" or "Coffee at Starbucks"'
                className="w-full px-3 py-2 pr-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={toggleVoice}
                title="Voice input"
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${listening ? 'text-red-500 animate-pulse' : 'text-gray-400 hover:text-blue-500'}`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* AI Suggestion Banner */}
          {(aiLoading || aiSuggestion) && !form.category && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Sparkles className="w-4 h-4 text-blue-500 flex-shrink-0" />
              {aiLoading ? (
                <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> Analyzing with AI...
                </span>
              ) : aiSuggestion && (
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-xs text-blue-700 dark:text-blue-300">
                    AI suggests: <strong>{aiSuggestion.category}</strong>{' '}
                    <span className="text-blue-400">({Math.round(aiSuggestion.confidence * 100)}% confidence)</span>
                  </span>
                  <button
                    type="button"
                    onClick={applyAiSuggestion}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium ml-2 whitespace-nowrap"
                  >
                    Apply →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Category <span className="text-gray-400">(leave blank for AI auto-categorize)</span>
            </label>
            <select
              value={form.category}
              onChange={(e) => handleField('category', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Auto-categorize with AI</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Date *</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => handleField('date', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes + Tags */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={(e) => handleField('notes', e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tags</label>
              <input
                type="text"
                value={form.tags}
                onChange={(e) => handleField('tags', e.target.value)}
                placeholder="work, personal"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">Receipt (optional)</label>
            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-500">
                {receiptFile ? receiptFile.name : 'Upload image or PDF (max 5MB)'}
              </span>
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files[0])}
              />
            </label>
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => handleField('isRecurring', e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Recurring expense</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Saving...' : initialData ? 'Update' : 'Add expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
