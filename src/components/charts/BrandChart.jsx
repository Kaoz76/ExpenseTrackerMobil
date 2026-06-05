import React, { useState, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { FaTag } from 'react-icons/fa';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../context/LanguageContext';
import { getCategoryInfo } from '../../utils/categoryMap';

// Minimum slice percentage — anything below this gets merged into "Others"
const MIN_SLICE_PCT = 3;

// Active shape renderer for hover / touch — enlarges the slice so it's easy to interact with
const renderActiveShape = (props) => {
  const {
    cx, cy, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent
  } = props;

  return (
    <g>
      {/* Enlarged slice */}
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={outerRadius + 10}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))', transition: 'all 0.2s ease' }}
      />
      {/* Center label */}
      <text x={cx} y={cy - 8} textAnchor="middle" fill={fill} fontWeight="700" fontSize={14}>
        {payload.name}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--bs-secondary-color)" fontSize={12}>
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

function BrandChart({ data, chartTheme }) {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(-1);

  // Merge tiny slices into "Others"
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
    if (totalAmount === 0) return [];

    const major = [];
    let othersAmount = 0;

    data.forEach((item) => {
      const pct = (item.amount / totalAmount) * 100;
      if (pct >= MIN_SLICE_PCT) {
        major.push(item);
      } else {
        othersAmount += item.amount;
      }
    });

    if (othersAmount > 0) {
      major.push({ name: t('common.others_combined'), amount: othersAmount });
    }

    return major;
  }, [data, t]);

  const onPieEnter = useCallback((_, index) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(-1);
  }, []);

  return (
    <div className="card border-0 shadow-sm h-100">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 className="card-title fw-bold mb-1">{t('common.by_brand')}</h5>
            <p className="text-muted small mb-0">{t('common.where_money_goes_brand')}</p>
          </div>
          <div className="bg-info-subtle p-2 rounded text-info-emphasis">
            <FaTag />
          </div>
        </div>

        {processedData.length === 0 ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: 300 }}>
            <p className="text-muted">{t('common.pie_no_data')}</p>
          </div>
        ) : (
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={processedData}
                  dataKey="amount"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="none"
                  activeIndex={activeIndex}
                  activeShape={renderActiveShape}
                  onMouseEnter={onPieEnter}
                  onMouseLeave={onPieLeave}
                  minAngle={8}
                >
                  {processedData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getCategoryInfo(entry.name).color}
                      style={{ cursor: 'pointer', outline: 'none' }}
                    />
                  ))}
                </Pie>
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
                  formatter={(value) => [formatPrice(value), t('common.amount')]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Custom legend */}
        {processedData.length > 0 && (
          <div className="d-flex flex-wrap justify-content-center gap-2 mt-2" style={{ maxHeight: '80px', overflowY: 'auto' }}>
            {processedData.map((entry, index) => {
              const color = getCategoryInfo(entry.name).color;
              const isActive = index === activeIndex;
              return (
                <span
                  key={index}
                  className="d-inline-flex align-items-center px-2 py-1 rounded-pill"
                  style={{
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    backgroundColor: isActive ? `${color}22` : 'transparent',
                    border: `1px solid ${isActive ? color : 'var(--bs-border-color)'}`,
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                  onClick={() => setActiveIndex(index === activeIndex ? -1 : index)}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: color,
                      marginRight: 5,
                      flexShrink: 0,
                    }}
                  />
                  {entry.name}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandChart;
