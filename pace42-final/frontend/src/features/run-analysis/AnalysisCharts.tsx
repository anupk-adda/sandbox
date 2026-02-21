import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Chart } from '../../services/chatService';

type AnalysisChartsProps = {
  charts: Chart[];
};

const buildChartData = (chart: Chart) => {
  const rows = chart.xLabels.map((label, index) => {
    const row: Record<string, number | string> = { label };
    chart.series.forEach((series) => {
      row[series.label] = series.data[index] ?? null;
    });
    return row;
  });
  return rows;
};

export const AnalysisCharts = ({ charts }: AnalysisChartsProps) => {
  if (!charts.length) return null;

  return (
    <div className="space-y-4">
      {charts.map((chart) => {
        const data = buildChartData(chart);
        return (
          <div key={chart.id} className="glass-card p-4">
            <div className="text-white font-semibold mb-2">{chart.title}</div>
            {chart.note && <div className="text-white/50 text-xs mb-3">{chart.note}</div>}
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer>
                {chart.type === 'bar' ? (
                  <BarChart data={data}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(226, 232, 240, 0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(226, 232, 240, 0.6)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0b1220', border: '1px solid rgba(148, 163, 184, 0.3)' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    {chart.series.map((series) => (
                      <Bar
                        key={series.label}
                        dataKey={series.label}
                        fill={series.color || '#38bdf8'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                ) : (
                  <LineChart data={data}>
                    <CartesianGrid stroke="rgba(148, 163, 184, 0.2)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: 'rgba(226, 232, 240, 0.6)', fontSize: 11 }} />
                    <YAxis tick={{ fill: 'rgba(226, 232, 240, 0.6)', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: '#0b1220', border: '1px solid rgba(148, 163, 184, 0.3)' }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    {chart.series.map((series) => (
                      <Line
                        key={series.label}
                        type="monotone"
                        dataKey={series.label}
                        stroke={series.color || '#38bdf8'}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
};
