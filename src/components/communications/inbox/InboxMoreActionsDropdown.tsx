import { MoreVertical, Save, UserPlus, FileText, Printer, Archive, Calendar, Bell, ExternalLink, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const INCOME_REPORT_URL = "https://www.peachhausgroup.com/embed/income-report";

interface InboxMoreActionsDropdownProps {
  onSaveMessage?: () => void;
  onCreateLead?: () => void;
  onArchive?: () => void;
  onAddToCalendar?: () => void;
  onSetReminder?: () => void;
  onPrint?: () => void;
  onSummarize?: () => void;
  isSummarizing?: boolean;
  showSaveMessage?: boolean;
  showCreateLead?: boolean;
  showSummarize?: boolean;
  disabled?: boolean;
}

export function InboxMoreActionsDropdown({
  onSaveMessage,
  onCreateLead,
  onArchive,
  onAddToCalendar,
  onSetReminder,
  onPrint,
  onSummarize,
  isSummarizing = false,
  showSaveMessage = true,
  showCreateLead = true,
  showSummarize = true,
  disabled = false,
}: InboxMoreActionsDropdownProps) {
  const handleOpenIncomeReport = () => {
    const newWindow = window.open(INCOME_REPORT_URL, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      toast.error("Please allow popups to open the income report tool");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-9 w-9 shrink-0"
          disabled={disabled}
        >
          <MoreVertical className="h-5 w-5" />
          <span className="sr-only">More actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {showSaveMessage && onSaveMessage && (
          <DropdownMenuItem onClick={onSaveMessage} className="gap-2">
            <Save className="h-4 w-4" />
            <span>Save Message</span>
          </DropdownMenuItem>
        )}
        
        {showCreateLead && onCreateLead && (
          <DropdownMenuItem onClick={onCreateLead} className="gap-2">
            <UserPlus className="h-4 w-4" />
            <span>Create Lead</span>
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        {/* Summarize */}
        {showSummarize && onSummarize && (
          <DropdownMenuItem onClick={onSummarize} disabled={isSummarizing} className="gap-2">
            {isSummarizing ? (
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
            <span>{isSummarizing ? "Summarizing..." : "Summarize"}</span>
          </DropdownMenuItem>
        )}
        
        {/* Income Report */}
        <DropdownMenuItem onClick={handleOpenIncomeReport} className="gap-2">
          <FileText className="h-4 w-4 text-orange-500" />
          <span className="flex-1">Income Report</span>
          <ExternalLink className="h-3 w-3 opacity-50" />
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {onPrint && (
          <DropdownMenuItem onClick={onPrint} className="gap-2">
            <Printer className="h-4 w-4" />
            <span>Print / Export</span>
          </DropdownMenuItem>
        )}
        
        {onArchive && (
          <DropdownMenuItem onClick={onArchive} className="gap-2">
            <Archive className="h-4 w-4" />
            <span>Archive</span>
          </DropdownMenuItem>
        )}
        
        {onAddToCalendar && (
          <DropdownMenuItem onClick={onAddToCalendar} className="gap-2">
            <Calendar className="h-4 w-4" />
            <span>Add to Calendar</span>
          </DropdownMenuItem>
        )}
        
        {onSetReminder && (
          <DropdownMenuItem onClick={onSetReminder} className="gap-2">
            <Bell className="h-4 w-4" />
            <span>Set Reminder</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
