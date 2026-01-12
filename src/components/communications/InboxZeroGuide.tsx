import { useState } from "react";
import { X, Inbox, Clock, CheckCheck, Zap, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface InboxZeroGuideProps {
  onDismiss?: () => void;
}

export function InboxZeroGuide({ onDismiss }: InboxZeroGuideProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-primary" />
            Inbox Zero Workflow
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            {/* What is Inbox Zero */}
            <div>
              <h3 className="font-semibold text-sm mb-2">What is Inbox Zero?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Inbox Zero is a productivity method where your goal is to keep your inbox empty—or near empty—at all times. 
                Instead of letting messages pile up, you process each one immediately by taking action, snoozing it, or marking it done.
              </p>
            </div>

            {/* Status Guide */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Conversation Statuses</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/10">
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                    <Inbox className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Open</p>
                    <p className="text-xs text-muted-foreground">Needs your attention. Review and respond or take action.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10">
                  <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Snoozed</p>
                    <p className="text-xs text-muted-foreground">Will reappear in your inbox later. Use when you can't respond now but need to follow up.</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10">
                  <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <CheckCheck className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Done</p>
                    <p className="text-xs text-muted-foreground">Conversation is resolved. No further action needed.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Priority Guide */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Priority Levels</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10">
                    <Zap className="h-3 w-3 text-red-600" />
                    <span className="text-xs font-medium text-red-600">Urgent</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Emergency, broken, not working, ASAP</p>
                </div>
                
                <div className="flex items-center gap-3 p-2 rounded-lg border">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-amber-500/10">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    <span className="text-xs font-medium text-amber-600">Important</span>
                  </div>
                  <p className="text-xs text-muted-foreground">New leads, booking inquiries, owner messages</p>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div>
              <h3 className="font-semibold text-sm mb-3">Quick Tips</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Process daily:</strong> Check your inbox at set times and process everything.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>2-minute rule:</strong> If it takes less than 2 minutes, do it now.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Snooze strategically:</strong> Use snooze for messages you can't act on immediately.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Mark done aggressively:</strong> If you've responded or it needs no action, mark it done.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span><strong>Use filters:</strong> Focus on "Urgent" first, then "Open", then check "Snoozed".</span>
                </li>
              </ul>
            </div>

            {/* Goal */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              <p className="text-sm font-medium">🎯 Your Goal</p>
              <p className="text-sm text-muted-foreground mt-1">
                End each day with zero items in your "Open" filter. Every message should be Done, Snoozed, or actively being worked on.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
