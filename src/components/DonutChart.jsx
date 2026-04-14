import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const DonutLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos((-midAngle * Math.PI) / 180);
  const y = cy + radius * Math.sin((-midAngle * Math.PI) / 180);

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      stroke="rgba(0,0,0,0.8)"
      strokeWidth="3"
      paintOrder="stroke"
      textAnchor="middle"
      dominantBaseline="central"
      className="text-sm font-black"
      style={{
        filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.5))",
      }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const { name, value } = payload[0].payload;
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg border border-slate-700 shadow-lg">
        <p className="font-bold text-sm">{name}</p>
        <p className="text-xs font-semibold text-blue-300">Count: {value}</p>
        <p className="text-xs font-semibold text-emerald-300">
          {percent.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ displayData, colors }) => {
  const totalValue = displayData.reduce((sum, item) => sum + item.value, 0);
  return (
    <ul className="flex flex-wrap justify-center gap-x-5 gap-y-3 mt-2 px-4 pb-2 w-full">
      {displayData.map((item, index) => {
        const percent =
          totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : 0;
        const color = item.color || colors[item.originalIndex % colors.length];
        return (
          <li
            key={`item-${index}`}
            className="flex items-center text-sm text-slate-700 font-semibold gap-2"
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <span>{`${item.name}: ${item.value} (${percent}%)`}</span>
          </li>
        );
      })}
    </ul>
  );
};

/**
 * Reusable Donut Chart Component
 * @param {Array} data - Array of objects with {name, value}
 * @param {string} title - Chart title
 * @param {Array} colors - Array of color codes for each segment
 * @param {string} centerText - Text to display in center (optional)
 * @param {string} centerValue - Value to display in center (optional)
 */
export default function DonutChart({
  data,
  title,
  colors = [],
  centerText,
  centerValue,
  height = 400,
}) {
  // Ensure data has values and retain original index for color mapping
  const displayData = data
    .map((item, idx) => ({ ...item, originalIndex: idx }))
    .filter((item) => item.value > 0);

  if (displayData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-slate-500">
        <p className="text-sm font-semibold">No data available</p>
      </div>
    );
  }

  const total = displayData.reduce((sum, item) => sum + item.value, 0);

  // Responsive sizing
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const responsiveInner = isMobile ? 40 : 80;
  const responsiveOuter = isMobile ? 70 : 130;
  const responsiveHeight = isMobile ? Math.min(height, 250) : height;

  return (
    <div className="w-full h-full flex flex-col items-center">
      {title && (
        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600 mb-4">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={responsiveHeight}>
        <PieChart>
          <Pie
            data={displayData}
            cx="50%"
            cy="50%"
            innerRadius={responsiveInner}
            outerRadius={responsiveOuter}
            paddingAngle={2}
            dataKey="value"
            label={DonutLabel}
            labelLine={false}
          >
            {displayData.map((item, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={item.color || colors[item.originalIndex % colors.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />

          {centerText && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="text-2xl font-bold fill-slate-900"
            >
              {centerValue || centerText}
            </text>
          )}
        </PieChart>
      </ResponsiveContainer>
      <CustomLegend displayData={displayData} colors={colors} />
    </div>
  );
}
