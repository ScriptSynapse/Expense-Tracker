/**
 * pages/InsightsPage.jsx — AI-driven spending insights and predictions
 */

import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Lightbulb, Brain, AlertCircle, CheckCircle } from 'lucide-react';
import { insightAPI, expenseAPI } from '../services/api';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const TREND_CONFIG = {
  increasing: { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  decreasing: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  stable: { icon: Minus, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
};

const TYPE_CONFIG = {
  increase: { icon: TrendingUp, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800' },
  decrease: { icon: TrendingDown, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  warning: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' },
  success: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800' },
  new: { icon: Lightbulb, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800' },
};

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const [insightRes, breakdownRes] = await Promise.all([
          insightAPI.get(),
          expenseAPI.categoryBreakdown({
            startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
            endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
          }),
        ]);

        setInsights(insightRes.data.insights || []);
        setPrediction(insightRes.data.prediction || null);
        setCategoryData(breakdownRes.data.breakdown || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-400">Analyzing your spending patterns...</p>
      </div>
    );
  }

  const trendConfig = prediction ? TREND_CONFIG[prediction.trend] || TREND_CONFIG.stable : null;
  const TrendIcon = trendConfig?.icon || Minus;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Insights</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">AI-powered analysis of your spending habits</p>
      </div>

      {/* Prediction card */}
      {prediction && (
        <div className={`rounded-xl border p-5 ${trendConfig?.bg} ${trendConfig?.border}`}>
          <div className="flex items-center gap-2 mb-3">
            <Brain className={`w-5 h-5 ${trendConfig?.color}`} />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Next month prediction</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${trendConfig?.color} font-medium`}>
              {prediction.confidence} confidence
            </span>
          </div>
          <div className="flex items-end gap-6">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                ${prediction.predicted?.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Predicted spending
              </p>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendIcon className={`w-4 h-4 ${trendConfig?.color}`} />
                <span className={`text-sm font-medium capitalize ${trendConfig?.color}`}>{prediction.trend}</span>
                {prediction.trendPercent !== 0 && (
                  <span className="text-xs text-gray-500">({prediction.trendPercent > 0 ? '+' : ''}{prediction.trendPercent}% vs avg)</span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">{prediction.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Insights list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Month-over-month changes</h2>
        {insights.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <Brain className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Not enough data yet. Add more expenses to get insights.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, i) => {
              const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.new;
              const Icon = config.icon;
              return (
                <div key={i} className={`rounded-xl border p-4 ${config.bg} ${config.border}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 dark:text-gray-200">{insight.message}</p>
                      {insight.tip && (
                        <div className="flex items-start gap-1.5 mt-2">
                          <Lightbulb className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-600 dark:text-gray-400">{insight.tip}</p>
                        </div>
                      )}
                    </div>
                    {insight.change !== undefined && (
                      <span className={`text-sm font-semibold whitespace-nowrap ${config.color}`}>
                        {insight.change > 0 ? '+' : ''}{insight.change}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Category bar chart */}
      {categoryData.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Spending by category (this month)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
              <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="category" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Spent']} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Smart tips */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Cost-saving tips</h2>
        </div>
        <div className="space-y-3">
          {[
            { tip: 'Track every small expense — coffee, parking, and snacks often add up to 10–15% of monthly spending.', category: 'General' },
            { tip: 'Review your subscriptions monthly. The average person pays for 3+ services they rarely use.', category: 'Entertainment' },
            { tip: 'Meal prepping 3 days a week can reduce food expenses by up to 30%.', category: 'Food & Dining' },
            { tip: 'Use public transport or carpool for regular commutes — can save $100–$300/month.', category: 'Transport' },
            { tip: 'Set an automatic transfer to savings on payday — pay yourself first before discretionary spending.', category: 'Investments' },
          ].map(({ tip, category }) => (
            <div key={tip} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-2" />
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">{tip}</p>
                <p className="text-xs text-gray-400 mt-0.5">{category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
