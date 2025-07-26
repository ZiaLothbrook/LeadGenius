import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartProps {
  campaigns?: any[];
  timeRange: string;
}

export default function PerformanceChart({ campaigns = [], timeRange }: PerformanceChartProps) {
  const chartData = useMemo(() => {
    if (!campaigns?.length) {
      return [];
    }

    // Generate mock time series data based on campaigns
    const days = timeRange === "30days" ? 30 : timeRange === "90days" ? 90 : 180;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Calculate cumulative metrics
      const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
      const totalOpened = campaigns.reduce((sum, c) => sum + (c.opened || 0), 0);
      const totalReplied = campaigns.reduce((sum, c) => sum + (c.replied || 0), 0);
      const totalConverted = campaigns.reduce((sum, c) => sum + (c.converted || 0), 0);
      
      // Simulate progressive growth over time
      const progress = (days - i) / days;
      const variance = 0.8 + (Math.random() * 0.4); // Add some randomness
      
      data.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sent: Math.floor(totalSent * progress * variance),
        opened: Math.floor(totalOpened * progress * variance),
        replied: Math.floor(totalReplied * progress * variance),
        converted: Math.floor(totalConverted * progress * variance),
        openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100 * variance).toFixed(1) : "0",
        responseRate: totalSent > 0 ? ((totalReplied / totalSent) * 100 * variance).toFixed(1) : "0",
        conversionRate: totalSent > 0 ? ((totalConverted / totalSent) * 100 * variance).toFixed(1) : "0",
      });
    }
    
    return data;
  }, [campaigns, timeRange]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-slate-200 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-slate-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey.includes('Rate') ? '%' : ''}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!chartData.length) {
    return (
      <div className="h-64 bg-slate-50 rounded-lg flex items-center justify-center">
        <div className="text-center text-slate-500">
          <div className="w-12 h-12 bg-slate-200 rounded mx-auto mb-3 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-sm">No performance data available</p>
          <p className="text-xs text-slate-400 mt-1">Data will appear once campaigns are active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Line 
            type="monotone" 
            dataKey="openRate" 
            stroke="hsl(221.2, 83.2%, 53.3%)" 
            strokeWidth={2}
            name="Open Rate (%)"
            dot={{ fill: "hsl(221.2, 83.2%, 53.3%)", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="responseRate" 
            stroke="hsl(142.1, 76.2%, 36.3%)" 
            strokeWidth={2}
            name="Response Rate (%)"
            dot={{ fill: "hsl(142.1, 76.2%, 36.3%)", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="conversionRate" 
            stroke="hsl(271.5, 81.3%, 55.9%)" 
            strokeWidth={2}
            name="Conversion Rate (%)"
            dot={{ fill: "hsl(271.5, 81.3%, 55.9%)", strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
