import { Users, ClipboardList, Clock, DollarSign } from "lucide-react";

interface VendorKPIBarProps {
  totalVendors: number;
  openWorkOrders: number;
  avgResponseTime: number | null;
  monthlyServicesCost: number;
}

export function VendorKPIBar({
  totalVendors,
  openWorkOrders,
  avgResponseTime,
  monthlyServicesCost,
}: VendorKPIBarProps) {
  const kpis = [
    {
      icon: Users,
      value: totalVendors,
      label: "Active Vendors",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: ClipboardList,
      value: openWorkOrders,
      label: "Open WOs",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      icon: Clock,
      value: avgResponseTime ? `${avgResponseTime.toFixed(1)}h` : "—",
      label: "Avg Response",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: DollarSign,
      value: `$${monthlyServicesCost.toLocaleString()}`,
      label: "Monthly Services",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((kpi, index) => (
        <div
          key={index}
          className={`flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm`}
        >
          <div className={`rounded-lg p-2.5 ${kpi.bgColor}`}>
            <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
            <div className="text-xs text-muted-foreground">{kpi.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
