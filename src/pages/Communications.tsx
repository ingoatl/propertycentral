import { InboxView } from "@/components/communications/InboxView";
import { MessageSquare } from "lucide-react";

const Communications = () => {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <MessageSquare className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communications Hub</h1>
          <p className="text-muted-foreground">
            View and manage all SMS, calls, and emails in one place
          </p>
        </div>
      </div>

      {/* Inbox View */}
      <InboxView />
    </div>
  );
};

export default Communications;
