import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, CheckCircle, XCircle, AlertTriangle, RefreshCw, ExternalLink, Clock } from "lucide-react";
import { format, formatDistanceToNow, isPast, addDays, isBefore } from "date-fns";

interface GmailTokenStatus {
  connected: boolean;
  expiresAt: Date | null;
  lastUpdated: Date | null;
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export const GmailIntegrationCard = () => {
  const [status, setStatus] = useState<GmailTokenStatus>({
    connected: false,
    expiresAt: null,
    lastUpdated: null,
    isExpired: false,
    isExpiringSoon: false,
  });
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadGmailStatus();
  }, []);

  const loadGmailStatus = async () => {
    try {
      const { data: tokens, error } = await supabase
        .from('gmail_oauth_tokens')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (!tokens || tokens.length === 0) {
        setStatus({
          connected: false,
          expiresAt: null,
          lastUpdated: null,
          isExpired: false,
          isExpiringSoon: false,
        });
      } else {
        const token = tokens[0];
        const expiresAt = new Date(token.expires_at);
        const now = new Date();
        const threeDaysFromNow = addDays(now, 3);

        setStatus({
          connected: true,
          expiresAt,
          lastUpdated: new Date(token.updated_at),
          isExpired: isPast(expiresAt),
          isExpiringSoon: isBefore(expiresAt, threeDaysFromNow) && !isPast(expiresAt),
        });
      }
    } catch (error) {
      console.error('Error loading Gmail status:', error);
      toast.error('Failed to load Gmail status');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnectGmail = async () => {
    setReconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please log in first');
        setReconnecting(false);
        return;
      }

      // Open popup IMMEDIATELY on click to avoid browser blocking
      const popup = window.open('about:blank', 'gmail-auth', 'width=600,height=700,scrollbars=yes');
      
      if (!popup) {
        toast.error('Popup was blocked. Please allow popups for this site.');
        setReconnecting(false);
        return;
      }

      // Show loading message in popup
      popup.document.write('<html><body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;"><p>Loading Google Sign-In...</p></body></html>');

      // Call edge function to get OAuth URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-init`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        popup.close();
        toast.error(result.error || 'Failed to initialize Gmail connection');
        setReconnecting(false);
        return;
      }

      // Redirect popup to OAuth URL
      popup.location.href = result.authUrl;
      
      // Listen for popup close
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          setReconnecting(false);
          // Reload status after a short delay
          setTimeout(loadGmailStatus, 2000);
          toast.success('Gmail authorization completed. Checking connection...');
        }
      }, 500);

    } catch (error) {
      console.error('Error reconnecting Gmail:', error);
      toast.error('Failed to start Gmail reconnection');
      setReconnecting(false);
    }
  };

  const handleCheckHealth = async () => {
    setCheckingHealth(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-gmail-token-health`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (result.status === 'healthy') {
        if (result.was_refreshed) {
          toast.success('Gmail token was refreshed successfully!');
        } else {
          toast.success('Gmail connection is healthy!');
        }
        await loadGmailStatus();
      } else if (result.status === 'expired') {
        toast.error('Gmail token expired. Please reconnect.');
        await loadGmailStatus();
      } else if (result.status === 'not_connected') {
        toast.info('Gmail is not connected yet.');
      } else {
        toast.warning(result.message || 'Unknown status');
      }
    } catch (error) {
      console.error('Error checking health:', error);
      toast.error('Failed to check Gmail health');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleScanGmail = async () => {
    setScanning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Not authenticated');
        return;
      }

      toast.info('Starting Gmail scan...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-gmail`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || 'Gmail scan completed!');
        await loadGmailStatus();
      } else {
        toast.error(result.error || 'Gmail scan failed');
      }
    } catch (error) {
      console.error('Error scanning Gmail:', error);
      toast.error('Failed to scan Gmail');
    } finally {
      setScanning(false);
    }
  };

  const getStatusBadge = () => {
    if (!status.connected) {
      return <Badge variant="outline" className="gap-1"><XCircle className="w-3 h-3" /> Not Connected</Badge>;
    }
    if (status.isExpired) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Expired</Badge>;
    }
    if (status.isExpiringSoon) {
      return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 border-amber-300"><AlertTriangle className="w-3 h-3" /> Expiring Soon</Badge>;
    }
    return <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-300"><CheckCircle className="w-3 h-3" /> Connected</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Gmail Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Gmail Integration
            </CardTitle>
            <CardDescription>
              Scans emails for Amazon orders, utility bills, and property expenses
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isExpired && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Gmail connection has expired. Email scanning is not working. Please reconnect below.
            </AlertDescription>
          </Alert>
        )}

        {status.isExpiringSoon && !status.isExpired && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Gmail connection will expire {status.expiresAt && formatDistanceToNow(status.expiresAt, { addSuffix: true })}. Consider reconnecting to refresh the token.
            </AlertDescription>
          </Alert>
        )}

        {status.connected && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Token Expires:</span>
              <span className={status.isExpired ? 'text-destructive font-medium' : ''}>
                {status.expiresAt && format(status.expiresAt, 'PPp')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span>
                {status.lastUpdated && formatDistanceToNow(status.lastUpdated, { addSuffix: true })}
              </span>
            </div>
          </div>
        )}

        {!status.connected && (
          <p className="text-sm text-muted-foreground">
            Connect Gmail to automatically scan for Amazon order confirmations, utility bills, and property-related expenses.
          </p>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleReconnectGmail} 
            disabled={reconnecting}
            variant={status.connected && !status.isExpired ? "outline" : "default"}
          >
            {reconnecting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4 mr-2" />
                {status.connected ? 'Reconnect Gmail' : 'Connect Gmail'}
              </>
            )}
          </Button>

          {status.connected && (
            <Button 
              variant="outline" 
              onClick={handleCheckHealth}
              disabled={checkingHealth}
            >
              {checkingHealth ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh Token
                </>
              )}
            </Button>
          )}

          {status.connected && !status.isExpired && (
            <Button 
              variant="secondary" 
              onClick={handleScanGmail}
              disabled={scanning}
            >
              {scanning ? (
                <>
                  <Mail className="w-4 h-4 mr-2 animate-pulse" />
                  Scanning...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Scan Gmail Now
                </>
              )}
            </Button>
          )}
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
          <p><strong>Note:</strong> If tokens expire frequently, publish the Google Cloud OAuth app to production mode.</p>
          <p>Go to Google Cloud Console → APIs & Services → OAuth consent screen → Publish App</p>
        </div>
      </CardContent>
    </Card>
  );
};
