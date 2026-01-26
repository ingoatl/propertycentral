import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Shield, 
  X, 
  Edit2, 
  UserCheck,
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ComplianceIssue {
  phrase: string;
  category: string;
  severity: 'block' | 'warn' | 'context';
  suggestion: string;
  note?: string;
}

interface ComplianceAlertProps {
  issues: ComplianceIssue[];
  riskScore: number;
  requiresBrokerReview: boolean;
  onEdit: () => void;
  onRequestBrokerReview?: () => void;
  onDismiss?: () => void;
  className?: string;
}

const categoryLabels: Record<string, string> = {
  familial_status: 'Familial Status',
  race_color: 'Race/Color',
  national_origin: 'National Origin',
  religion: 'Religion',
  disability: 'Disability',
  sex_gender: 'Sex/Gender'
};

const severityColors: Record<string, string> = {
  block: 'bg-destructive text-destructive-foreground',
  warn: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  context: 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
};

export function ComplianceAlert({
  issues,
  riskScore,
  requiresBrokerReview,
  onEdit,
  onRequestBrokerReview,
  onDismiss,
  className
}: ComplianceAlertProps) {
  const [expanded, setExpanded] = useState(true);
  
  const blockingIssues = issues.filter(i => i.severity === 'block');
  const warningIssues = issues.filter(i => i.severity === 'warn');
  const contextIssues = issues.filter(i => i.severity === 'context');
  
  const hasBlockingIssues = blockingIssues.length > 0;

  if (issues.length === 0 && !requiresBrokerReview) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("space-y-3", className)}
    >
      <Alert 
        variant={hasBlockingIssues ? "destructive" : "default"}
        className={cn(
          "border-2",
          hasBlockingIssues 
            ? "border-destructive/50 bg-destructive/5" 
            : requiresBrokerReview
              ? "border-yellow-500/50 bg-yellow-500/5"
              : "border-yellow-500/30 bg-yellow-500/5"
        )}
      >
        <div className="flex items-start gap-3">
          {hasBlockingIssues ? (
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          ) : (
            <Shield className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <AlertTitle className="text-base font-semibold">
                {hasBlockingIssues 
                  ? 'Fair Housing Compliance Issue' 
                  : requiresBrokerReview 
                    ? 'Broker Review Required'
                    : 'Compliance Warning'
                }
              </AlertTitle>
              
              <div className="flex items-center gap-2">
                {riskScore > 0 && (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs",
                      riskScore >= 60 ? "border-destructive text-destructive" :
                      riskScore >= 30 ? "border-yellow-500 text-yellow-600" :
                      "border-blue-500 text-blue-600"
                    )}
                  >
                    Risk: {riskScore}%
                  </Badge>
                )}
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
                
                {onDismiss && !hasBlockingIssues && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onDismiss}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            
            <AlertDescription className="mt-1 text-sm text-muted-foreground">
              {hasBlockingIssues 
                ? 'Your message contains language that may violate the Fair Housing Act.'
                : requiresBrokerReview
                  ? 'This message discusses topics that require broker authorization under GA law.'
                  : 'Review these items before sending.'
              }
            </AlertDescription>
            
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    {/* Blocking Issues */}
                    {blockingIssues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-destructive uppercase tracking-wide">
                          Must Fix ({blockingIssues.length})
                        </p>
                        {blockingIssues.map((issue, idx) => (
                          <IssueCard key={idx} issue={issue} />
                        ))}
                      </div>
                    )}
                    
                    {/* Warning Issues */}
                    {warningIssues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">
                          Review Recommended ({warningIssues.length})
                        </p>
                        {warningIssues.map((issue, idx) => (
                          <IssueCard key={idx} issue={issue} />
                        ))}
                      </div>
                    )}
                    
                    {/* Context Issues */}
                    {contextIssues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                          Context Dependent ({contextIssues.length})
                        </p>
                        {contextIssues.map((issue, idx) => (
                          <IssueCard key={idx} issue={issue} />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={onEdit}
                      className="gap-1.5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit Message
                    </Button>
                    
                    {requiresBrokerReview && onRequestBrokerReview && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={onRequestBrokerReview}
                        className="gap-1.5"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Request Broker Review
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Alert>
    </motion.div>
  );
}

function IssueCard({ issue }: { issue: ComplianceIssue }) {
  return (
    <div className="p-3 rounded-lg bg-background border text-sm">
      <div className="flex items-start gap-2">
        <Badge 
          variant="secondary" 
          className={cn("shrink-0 text-xs", severityColors[issue.severity])}
        >
          {categoryLabels[issue.category] || issue.category}
        </Badge>
      </div>
      
      <div className="mt-2 space-y-1">
        <p className="font-medium">
          <span className="text-destructive">"{issue.phrase}"</span>
        </p>
        <p className="text-muted-foreground flex items-start gap-1.5">
          <span className="text-green-600 shrink-0">✓</span>
          <span>Suggested: "{issue.suggestion}"</span>
        </p>
        {issue.note && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5 mt-1">
            <Info className="h-3 w-3 shrink-0 mt-0.5" />
            <span>{issue.note}</span>
          </p>
        )}
      </div>
    </div>
  );
}
