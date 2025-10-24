import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertySummary } from "@/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface RevenueBarChartProps {
  properties: PropertySummary[];
}

export const RevenueBarChart = ({ properties }: RevenueBarChartProps) => {
  const chartData = properties
    .sort((a, b) => b.ownerrezRevenue - a.ownerrezRevenue)
    .map(p => ({
      name: p.property.name.length > 20 ? p.property.name.substring(0, 20) + '...' : p.property.name,
      revenue: Number(p.ownerrezRevenue.toFixed(0)),
      thisMonth: Number((p.thisMonthRevenue || 0).toFixed(0)),
      lastMonth: Number((p.lastMonthRevenue || 0).toFixed(0)),
    }));

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg">Revenue Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 80 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                className="text-xs"
              />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Total Revenue" radius={[8, 8, 0, 0]} />
              <Bar dataKey="thisMonth" fill="hsl(var(--chart-1))" name="This Month" radius={[8, 8, 0, 0]} />
              <Bar dataKey="lastMonth" fill="hsl(var(--chart-2))" name="Last Month" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
