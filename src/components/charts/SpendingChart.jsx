import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FaCalendarAlt, FaArrowUp } from 'react-icons/fa';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../context/LanguageContext';

function SpendingChart({ data, totalSpent, timeRangeLabel, chartTheme, isDark }) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  return (
    <div className="card border-0 shadow-sm h-100 card-accent">
      <div className="card-body p-3 p-md-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 className="card-title fw-bold mb-1">{t('common.spending_over_time')}</h5>
            <p className="text-muted small mb-0">{t('common.breakdown_for')} <strong>{timeRangeLabel}</strong></p>
          </div>
          <div className="bg-primary-subtle p-2 rounded text-primary">
            <FaCalendarAlt />
          </div>
        </div>

        <div className="d-flex align-items-baseline mb-4">
          <h2 className="fw-bold me-3 mb-0">
            {formatPrice(totalSpent)}
          </h2>
          <span className="text-success fw-medium d-flex align-items-center">
            <FaArrowUp className="me-1 small" /> {t('common.total_selected')}
          </span>
        </div>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTheme.areaStop1} stopOpacity={chartTheme.areaOpacity} />
                  <stop offset="50%" stopColor={chartTheme.areaStop2} stopOpacity={chartTheme.areaOpacity * 0.4} />
                  <stop offset="95%" stopColor={chartTheme.areaStop1} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: chartTheme.axisColor, fontSize: 12 }} />
              <YAxis hide={true} />
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={chartTheme.gridOpacity} />

              <Tooltip
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  borderRadius: '12px',
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  color: chartTheme.tooltipColor,
                  padding: '10px 14px',
                }}
                itemStyle={{ color: chartTheme.tooltipColor }}
                labelStyle={{ color: chartTheme.axisColor, marginBottom: 4, fontWeight: 600 }}
                formatter={(value) => [formatPrice(value), t('common.amount')]}
              />

              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke={chartTheme.lineColor} 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorAmount)"
                dot={{ r: 3, fill: chartTheme.lineColor, strokeWidth: 2, stroke: isDark ? '#1e293b' : '#fff' }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default SpendingChart;
