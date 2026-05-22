import React from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { FaChartPie } from 'react-icons/fa';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryInfo } from '../../utils/categoryMap';

function CategoryChart({ data, chartTheme, isDark }) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 className="card-title fw-bold mb-1">{t('common.by_category')}</h5>
            <p className="text-muted small mb-0">{t('common.where_money_goes')}</p>
          </div>
          <div className="bg-info-subtle p-2 rounded text-info-emphasis">
            <FaChartPie />
          </div>
        </div>

        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
              <XAxis type="number" hide={true} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 12, fill: chartTheme.axisColor }} />

              <Tooltip
                cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  borderRadius: '12px',
                  border: `1px solid ${chartTheme.tooltipBorder}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  color: chartTheme.tooltipColor,
                  padding: '10px 14px',
                }}
                itemStyle={{ color: chartTheme.tooltipColor }}
                labelStyle={{ color: chartTheme.axisColor, fontWeight: 600 }}
                formatter={(value) => [formatPrice(value), t('common.amount')]}
              />

              <Bar dataKey="amount" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={22}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getCategoryInfo(entry.name).color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default CategoryChart;
