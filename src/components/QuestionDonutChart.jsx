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
        <p className="text-xs font-semibold text-blue-300">
          Responses: {value}
        </p>
        <p className="text-xs font-semibold text-emerald-300">
          {percent.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

/**
 * Component to display donut chart for a single feedback question
 * @param {string} questionNumber - Q1, Q2, etc.
 * @param {string} questionText - The actual question text
 * @param {object} scoreCounts - {5: count, 4: count, ...}
 * @param {number} totalResponses - Total number of responses
 */
export default function QuestionDonutChart({
  questionNumber,
  questionText,
  scoreCounts,
  totalResponses,
}) {
  const COLORS = {
    5: "#22c55e", // Excellent - Green
    4: "#3b82f6", // Very Good - Blue
    3: "#eab308", // Good - Yellow
    2: "#f97316", // Satisfactory - Orange
    1: "#ef4444", // Poor - Red
  };

  const LABELS = {
    5: "Excellent (5)",
    4: "Very Good (4)",
    3: "Good (3)",
    2: "Satisfactory (2)",
    1: "Poor (1)",
  };

  // Prepare data for pie chart
  const chartData = Object.keys(scoreCounts)
    .map((rating) => ({
      name: LABELS[rating],
      value: scoreCounts[rating],
      rating: parseInt(rating),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.rating - a.rating); // Sort by rating descending

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-400">
        <p className="text-sm font-semibold">No responses</p>
      </div>
    );
  }

  const totalScore = Object.keys(scoreCounts).reduce(
    (sum, rating) => sum + parseInt(rating) * scoreCounts[rating],
    0,
  );
  const avgScore =
    totalResponses > 0 ? Math.round(totalScore / totalResponses) : 0;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const responsiveHeight = isMobile ? 180 : 280; // Even smaller height for mobile

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Q{questionNumber}. {questionText}
            </h4>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="text-2xl font-bold text-blue-600">{avgScore}</div>
            <p className="text-xs text-slate-500 font-semibold">/ 5.0</p>
          </div>
        </div>
      </div>

      <div className="mt-auto">
        <ResponsiveContainer width="100%" height={responsiveHeight}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 30 : 45}
              outerRadius={isMobile ? 60 : 85}
              paddingAngle={1}
              dataKey="value"
              label={DonutLabel}
              labelLine={false}
            >
              {chartData.map((entry, idx) => (
                <Cell key={`cell-${idx}`} fill={COLORS[entry.rating]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip total={totalResponses} />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs min-h-[76px] content-start">
          {chartData.map((item) => {
            const percentage =
              totalResponses > 0
                ? ((item.value / totalResponses) * 100).toFixed(1)
                : 0;
            return (
              <div key={item.rating} className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0`}
                  style={{ backgroundColor: COLORS[item.rating] }}
                ></div>
                <span className="font-semibold text-slate-700">
                  {item.name}: {item.value} ({percentage}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
