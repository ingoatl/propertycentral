import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquare, Check, DollarSign, Clock, CheckCircle2 } from "lucide-react";

export function WorkflowDiagram() {
  const steps = [
    { label: "New", icon: "📥", color: "bg-blue-100 border-blue-300" },
    { label: "Dispatched", icon: "📤", color: "bg-purple-100 border-purple-300" },
    { label: "Confirmed", icon: "✅", color: "bg-green-100 border-green-300" },
    { label: "In Progress", icon: "🔧", color: "bg-orange-100 border-orange-300" },
    { label: "Done", icon: "✓", color: "bg-emerald-100 border-emerald-300" },
  ];

  const smsCommands = [
    { command: "CONFIRM", action: "Accept job", icon: Check, color: "text-green-600" },
    { command: "DECLINE [reason]", action: "Decline job", icon: MessageSquare, color: "text-red-600" },
    { command: "QUOTE $xxx", action: "Submit quote", icon: DollarSign, color: "text-amber-600" },
    { command: "ETA xx:xx", action: "On the way", icon: Clock, color: "text-blue-600" },
    { command: "DONE", action: "Work complete", icon: CheckCircle2, color: "text-emerald-600" },
  ];

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          SMS Workflow Commands
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline Visual */}
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${step.color}`}
              >
                <span>{step.icon}</span>
                <span>{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mx-1 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>

        {/* SMS Commands Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {smsCommands.map((cmd) => (
            <div
              key={cmd.command}
              className="flex flex-col items-center gap-1 p-2 rounded-lg bg-muted/50 text-center"
            >
              <cmd.icon className={`h-4 w-4 ${cmd.color}`} />
              <Badge variant="outline" className="text-xs font-mono">
                {cmd.command.split(" ")[0]}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{cmd.action}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Vendors respond via SMS to +1 404-991-5076 to update work order status
        </p>
      </CardContent>
    </Card>
  );
}
