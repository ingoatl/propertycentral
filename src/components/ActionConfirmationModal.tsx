import { memo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone,
  MessageSquare,
  Mail,
  AlertTriangle,
  Clock,
  CheckCircle,
  X,
  User,
  Home,
  Zap,
  Bell,
} from "lucide-react";
import { usePendingActions, PendingAction } from "@/hooks/usePendingActions";
import { cn } from "@/lib/utils";

const channelConfig: Record<string, { icon: typeof Phone; label: string; color: string }> = {
  call: { icon: Phone, label: "Phone Call", color: "text-blue-500" },
  sms: { icon: MessageSquare, label: "SMS", color: "text-green-500" },
  email: { icon: Mail, label: "Email", color: "text-purple-500" },
};

const urgencyConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  critical: { label: "Critical", color: "text-red-700", bgColor: "bg-red-100 border-red-300" },
  high: { label: "High Priority", color: "text-orange-700", bgColor: "bg-orange-100 border-orange-300" },
  normal: { label: "Normal", color: "text-blue-700", bgColor: "bg-blue-100 border-blue-300" },
  low: { label: "Low Priority", color: "text-gray-600", bgColor: "bg-gray-100 border-gray-300" },
};

const actionTypeConfig: Record<string, { icon: typeof Phone; label: string }> = {
  callback: { icon: Phone, label: "Schedule Callback" },
  task: { icon: CheckCircle, label: "Create Task" },
  alert: { icon: Bell, label: "Alert" },
  escalation: { icon: AlertTriangle, label: "Escalation Required" },
  payment_reminder: { icon: Zap, label: "Payment Follow-up" },
};

interface ActionCardProps {
  action: PendingAction;
  onApprove: (actionId: string, customResponse?: string) => void;
  onDismiss: (actionId: string, reason?: string) => void;
  isApproving: boolean;
  isDismissing: boolean;
}

const ActionCard = memo(function ActionCard({
  action,
  onApprove,
  onDismiss,
  isApproving,
  isDismissing,
}: ActionCardProps) {
  const [showDismissReason, setShowDismissReason] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  const channel = channelConfig[action.channel || ""] || channelConfig.call;
  const urgency = urgencyConfig[action.urgency] || urgencyConfig.normal;
  const actionType = actionTypeConfig[action.action_type] || actionTypeConfig.task;

  const ChannelIcon = channel.icon;
  const ActionIcon = actionType.icon;

  const contactName = action.owner?.name || action.lead?.name || "Unknown Contact";
  const propertyInfo = action.property?.name || action.property?.address;

  return (
    <div className={cn("border rounded-lg p-4 space-y-3", urgency.bgColor)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-full bg-white shadow-sm", channel.color)}>
            <ChannelIcon className="w-4 h-4" />
          </div>
          <div>
            <p className="font-medium text-sm">{action.title}</p>
            <p className="text-xs text-muted-foreground">{channel.label}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-xs", urgency.color)}>
          {urgency.label}
        </Badge>
      </div>

      {/* Contact & Property Info */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <User className="w-3 h-3" />
          <span>{contactName}</span>
        </div>
        {propertyInfo && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Home className="w-3 h-3" />
            <span>{propertyInfo}</span>
          </div>
        )}
      </div>

      {/* Description */}
      {action.description && (
        <p className="text-sm text-foreground/80">{action.description}</p>
      )}

      {/* Detected Intent */}
      {action.detected_intent && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <ActionIcon className="w-3 h-3 mr-1" />
            {action.detected_intent.replace(/_/g, " ")}
          </Badge>
        </div>
      )}

      {/* Suggested Response */}
      {action.suggested_response && (
        <div className="bg-white/50 rounded-md p-3 text-sm border">
          <p className="text-xs font-medium text-muted-foreground mb-1">Suggested Action:</p>
          <p>{action.suggested_response}</p>
        </div>
      )}

      {/* Dismiss Reason Input */}
      {showDismissReason && (
        <div className="space-y-2">
          <Textarea
            placeholder="Reason for dismissing (optional)..."
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            className="text-sm min-h-[60px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onDismiss(action.id, dismissReason);
                setShowDismissReason(false);
                setDismissReason("");
              }}
              disabled={isDismissing}
            >
              Confirm Dismiss
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowDismissReason(false);
                setDismissReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {!showDismissReason && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowDismissReason(true)}
            disabled={isDismissing}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4 mr-1" />
            Dismiss
          </Button>
          <Button
            size="sm"
            onClick={() => onApprove(action.id)}
            disabled={isApproving}
            className="bg-primary hover:bg-primary/90"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
});

export function ActionConfirmationModal() {
  const {
    pendingActions,
    criticalActions,
    highActions,
    normalActions,
    isLoading,
    isEligibleUser,
    approveAction,
    dismissAction,
    isApproving,
    isDismissing,
  } = usePendingActions();

  const [isOpen, setIsOpen] = useState(true);

  // Don't render if not eligible or no actions
  if (!isEligibleUser || pendingActions.length === 0) {
    return null;
  }

  const handleApprove = (actionId: string, customResponse?: string) => {
    approveAction({ actionId, customResponse });
  };

  const handleDismiss = (actionId: string, reason?: string) => {
    dismissAction({ actionId, reason });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Pending Actions
            <Badge variant="secondary" className="ml-2">
              {pendingActions.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Review and approve actions detected from recent communications
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 pb-4">
            {/* Critical Actions */}
            {criticalActions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="font-semibold text-red-700">Critical Actions</h3>
                </div>
                {criticalActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                    isApproving={isApproving}
                    isDismissing={isDismissing}
                  />
                ))}
              </div>
            )}

            {/* High Priority Actions */}
            {highActions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <h3 className="font-semibold text-orange-700">High Priority</h3>
                </div>
                {highActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                    isApproving={isApproving}
                    isDismissing={isDismissing}
                  />
                ))}
              </div>
            )}

            {/* Normal/Low Actions */}
            {normalActions.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <h3 className="font-semibold">Other Actions</h3>
                </div>
                {normalActions.map((action) => (
                  <ActionCard
                    key={action.id}
                    action={action}
                    onApprove={handleApprove}
                    onDismiss={handleDismiss}
                    isApproving={isApproving}
                    isDismissing={isDismissing}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Review Later
          </Button>
          <p className="text-xs text-muted-foreground">
            Actions are detected from SMS, calls, and emails
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
