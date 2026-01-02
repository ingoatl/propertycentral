import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle, XCircle, AlertTriangle, RefreshCw, Mail, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    credentialsValid: boolean;
    tokenExists: boolean;
    tokenNotExpired: boolean;
    gmailApiEnabled: boolean;
    canFetchEmails: boolean;
  };
  errors: string[];
  recommendations: string[];
}

export function GmailHealthWatchdog() {
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    // Run health check on mount
    runHealthCheck();
  }, []);

  const runHealthCheck = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('gmail-health-check');

      if (error) throw error;

      setHealth(data);
      setLastChecked(new Date());

      if (!data.healthy) {
        toast.error('Gmail connection has issues - check the watchdog for details');
      }
    } catch (error: any) {
      console.error('Health check failed:', error);
      toast.error('Failed to run Gmail health check');
      setHealth({
        healthy: false,
        checks: {
          credentialsValid: false,
          tokenExists: false,
          tokenNotExpired: false,
          gmailApiEnabled: false,
          canFetchEmails: false,
        },
        errors: [error.message || 'Health check failed'],
        recommendations: ['Check edge function logs for more details'],
      });
    } finally {
      setLoading(false);
    }
  };

  const getCheckIcon = (passed: boolean) => {
    return passed ? (
      <CheckCircle className="w-4 h-4 text-green-600" />
    ) : (
      <XCircle className="w-4 h-4 text-red-600" />
    );
  };

  return (
    <Card className="shadow-card border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-5 h-5 text-primary" />
            Gmail Watchdog
          </CardTitle>
          <div className="flex items-center gap-2">
            {health && (
              <Badge variant={health.healthy ? "default" : "destructive"} className="gap-1">
                {health.healthy ? (
                  <>
                    <CheckCircle className="w-3 h-3" />
                    Healthy
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3" />
                    Issues
                  </>
                )}
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={runHealthCheck}
              disabled={loading}
              className="h-7 px-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !health ? (
          <div className="text-sm text-muted-foreground text-center py-2">
            Running health check...
          </div>
        ) : health ? (
          <>
            {/* Status Checks */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                {getCheckIcon(health.checks.credentialsValid)}
                <span className={health.checks.credentialsValid ? 'text-foreground' : 'text-muted-foreground'}>
                  Credentials valid
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getCheckIcon(health.checks.tokenExists)}
                <span className={health.checks.tokenExists ? 'text-foreground' : 'text-muted-foreground'}>
                  Token exists
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getCheckIcon(health.checks.tokenNotExpired)}
                <span className={health.checks.tokenNotExpired ? 'text-foreground' : 'text-muted-foreground'}>
                  Token valid
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getCheckIcon(health.checks.gmailApiEnabled)}
                <span className={health.checks.gmailApiEnabled ? 'text-foreground' : 'text-muted-foreground'}>
                  Gmail API enabled
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getCheckIcon(health.checks.canFetchEmails)}
                <span className={health.checks.canFetchEmails ? 'text-foreground' : 'text-muted-foreground'}>
                  Can fetch emails
                </span>
              </div>
            </div>

            {/* Errors & Recommendations */}
            {!health.healthy && health.errors.length > 0 && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-sm">Issues Found</AlertTitle>
                <AlertDescription className="text-xs space-y-1 mt-1">
                  {health.errors.map((error, idx) => (
                    <div key={idx}>• {error}</div>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            {health.recommendations.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Recommendations:
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  {health.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      {rec.includes('https://') ? (
                        <a
                          href={rec.match(/https:\/\/[^\s]+/)?.[0] || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline flex items-center gap-1 hover:text-blue-600"
                        >
                          {rec.replace(/https:\/\/[^\s]+/, '')}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <>• {rec}</>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {lastChecked && (
              <p className="text-xs text-muted-foreground text-right">
                Last checked: {lastChecked.toLocaleTimeString()}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            Click refresh to check Gmail health
          </p>
        )}
      </CardContent>
    </Card>
  );
}