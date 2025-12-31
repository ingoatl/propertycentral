import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, ChevronDown, AlertCircle, CheckCircle, Clock, TrendingUp, Trash2, DollarSign, Lightbulb, Heart, Frown, Meh, Zap, RefreshCw, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RescanEmailsButton } from "./RescanEmailsButton";

interface EmailInsight {
  id: string;
  propertyId: string | null;
  ownerId: string | null;
  emailDate: string;
  senderEmail: string;
  subject: string;
  summary: string;
  category: string;
  sentiment: string | null;
  actionRequired: boolean;
  suggestedActions: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  expenseDetected: boolean;
  expenseAmount: number | null;
  expenseDescription: string | null;
  expenseCreated: boolean;
  createdAt: string;
}

interface EmailInsightsCardProps {
  propertyId?: string;
  showHeader?: boolean;
}

export function EmailInsightsCard({ propertyId, showHeader = true }: EmailInsightsCardProps) {
  const [insights, setInsights] = useState<EmailInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    checkGmailConnection();
    loadInsights();
  }, [propertyId]);

  const checkGmailConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setGmailConnected(false);
        setTokenExpired(false);
        return;
      }

      const { data } = await supabase
        .from('gmail_oauth_tokens')
        .select('id, expires_at')
        .eq('user_id', user.id)
        .limit(1);
      
      if (data && data.length > 0) {
        setGmailConnected(true);
        // Check if token is expired
        const expiresAt = new Date(data[0].expires_at);
        const now = new Date();
        setTokenExpired(expiresAt < now);
      } else {
        setGmailConnected(false);
        setTokenExpired(false);
      }
    } catch (error) {
      setGmailConnected(false);
      setTokenExpired(false);
    }
  };

  const loadInsights = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('email_insights')
        .select('*')
        .order('email_date', { ascending: false })
        .limit(10);

      if (propertyId) {
        query = query.eq('property_id', propertyId);
      }

      const { data, error } = await query;

      if (error) throw error;

      setInsights((data || []).map(d => ({
        id: d.id,
        propertyId: d.property_id,
        ownerId: d.owner_id,
        emailDate: d.email_date,
        senderEmail: d.sender_email,
        subject: d.subject,
        summary: d.summary,
        category: d.category,
        sentiment: d.sentiment,
        actionRequired: d.action_required,
        suggestedActions: d.suggested_actions,
        dueDate: d.due_date,
        priority: d.priority,
        status: d.status,
        expenseDetected: d.expense_detected,
        expenseAmount: d.expense_amount,
        expenseDescription: d.expense_description,
        expenseCreated: d.expense_created,
        createdAt: d.created_at,
      })));
    } catch (error: any) {
      console.error('Error loading insights:', error);
      toast.error('Failed to load email insights');
    } finally {
      setLoading(false);
    }
  };

  const connectGmail = async () => {
    try {
      // Fetch the OAuth URL from the edge function (uses secrets for client ID)
      const { data, error } = await supabase.functions.invoke('gmail-auth-url');
      
      if (error || !data?.authUrl) {
        console.error('Error getting auth URL:', error);
        toast.error('Failed to start Gmail connection');
        return;
      }

      console.log('OAuth URL:', data.authUrl);
      
      const authWindow = window.open(data.authUrl, 'gmail-auth', 'width=600,height=700');
      
      const pollTimer = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(pollTimer);
          setTimeout(() => {
            checkGmailConnection();
            loadInsights();
          }, 1000);
        }
      }, 500);
    } catch (error: any) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail');
    }
  };

  const scanEmails = async () => {
    try {
      setScanning(true);
      toast.loading('Scanning emails...');

      const { data, error } = await supabase.functions.invoke('scan-gmail');

      if (error) throw error;

      toast.dismiss();
      toast.success(`Scanned ${data.emailsProcessed} emails, generated ${data.insightsGenerated} insights`);
      
      await loadInsights();
    } catch (error: any) {
      console.error('Error scanning emails:', error);
      toast.dismiss();
      toast.error('Failed to scan emails');
    } finally {
      setScanning(false);
    }
  };

  const disconnectGmail = async () => {
    if (!confirm("Are you sure you want to disconnect Gmail? You'll need to reconnect to scan emails again.")) {
      return;
    }

    try {
      setDisconnecting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Not authenticated');
        return;
      }

      const { error } = await supabase
        .from('gmail_oauth_tokens')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setGmailConnected(false);
      setTokenExpired(false);
      toast.success('Gmail disconnected successfully');
    } catch (error: any) {
      console.error('Error disconnecting Gmail:', error);
      toast.error('Failed to disconnect Gmail');
    } finally {
      setDisconnecting(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'maintenance': return '🔧';
      case 'payment': return '💳';
      case 'booking': return '📅';
      case 'tenant_communication': return '💬';
      case 'legal': return '⚖️';
      case 'insurance': return '🛡️';
      case 'utilities': return '⚡';
      case 'expense': return '💰';
      case 'order': return '📦';
      default: return '📧';
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    if (!sentiment) return null;
    switch (sentiment.toLowerCase()) {
      case 'positive':
        return <Heart className="w-4 h-4 text-green-600" />;
      case 'negative':
      case 'concerning':
        return <Frown className="w-4 h-4 text-red-600" />;
      case 'urgent':
        return <Zap className="w-4 h-4 text-orange-600" />;
      case 'neutral':
        return <Meh className="w-4 h-4 text-gray-600" />;
      default:
        return null;
    }
  };

  const handleDeleteInsight = async (id: string) => {
    if (!confirm("Are you sure you want to delete this email insight?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('email_insights')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadInsights();
      toast.success("Email insight deleted");
    } catch (error: any) {
      console.error("Error deleting insight:", error);
      toast.error("Failed to delete insight");
    }
  };

  const actionRequiredCount = insights.filter(i => i.actionRequired && i.status === 'new').length;

  // Show connect card if not connected
  if (!gmailConnected) {
    return (
      <Card className="shadow-card border-border/50 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Email Insights
          </CardTitle>
          <CardDescription>
            Connect your Gmail to automatically track property and owner communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connectGmail} disabled={connecting} className="w-full" size="lg">
            <Mail className="w-4 h-4 mr-2" />
            {connecting ? 'Connecting...' : 'Connect Gmail Account'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Show reconnect card if token is expired
  if (tokenExpired) {
    return (
      <Card className="shadow-card border-destructive/50 bg-gradient-to-br from-destructive/5 to-background">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Gmail Connection Expired
          </CardTitle>
          <CardDescription>
            Your Gmail connection has expired. Please reconnect to continue scanning emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={connectGmail} disabled={connecting} className="w-full" size="lg">
            <RefreshCw className="w-4 h-4 mr-2" />
            {connecting ? 'Reconnecting...' : 'Reconnect Gmail'}
          </Button>
          <Button 
            onClick={disconnectGmail} 
            disabled={disconnecting} 
            variant="outline" 
            className="w-full text-muted-foreground"
            size="sm"
          >
            <Unplug className="w-4 h-4 mr-2" />
            {disconnecting ? 'Disconnecting...' : 'Remove Connection'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-card border-border/50">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />
                <CardTitle>Email Insights</CardTitle>
                {actionRequiredCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {actionRequiredCount} Action{actionRequiredCount > 1 ? 's' : ''} Required
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <RescanEmailsButton />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation();
                    scanEmails();
                  }}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning...' : 'Scan New'}
                </Button>
                <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <CardDescription>
              AI-powered insights from your emails (last 35 days) • Scans daily at 6 AM
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading insights...</div>
            ) : insights.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No email insights yet. They'll appear here once emails are scanned.
              </div>
            ) : (
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg">{getCategoryIcon(insight.category)}</span>
                          <Badge variant="outline" className="capitalize">
                            {insight.category.replace('_', ' ')}
                          </Badge>
                          <Badge variant="outline" className={getPriorityColor(insight.priority)}>
                            {insight.priority}
                          </Badge>
                          {insight.actionRequired && insight.status === 'new' && (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Action Required
                            </Badge>
                          )}
                        </div>
                        
                        <p className="font-medium text-foreground line-clamp-1">{insight.subject}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{insight.summary}</p>
                        
                        {/* Sentiment Badge */}
                        {insight.sentiment && (
                          <div className="flex items-center gap-2">
                            {getSentimentIcon(insight.sentiment)}
                            <Badge variant="outline" className="capitalize text-xs">
                              {insight.sentiment}
                            </Badge>
                          </div>
                        )}

                        {/* Suggested Actions */}
                        {insight.suggestedActions && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                            <div className="flex items-start gap-2">
                              <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Suggested Actions:</p>
                                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
                                  {insight.suggestedActions.split(',').map((action, idx) => (
                                    <li key={idx}>• {action.trim()}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Expense Information */}
                        {insight.expenseDetected && (
                          <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                            <div className="flex items-start gap-2">
                              <DollarSign className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-green-900 dark:text-green-100">
                                  Expense Detected: ${insight.expenseAmount?.toFixed(2)}
                                </p>
                                {insight.expenseDescription && (
                                  <p className="text-xs text-green-800 dark:text-green-200">{insight.expenseDescription}</p>
                                )}
                                {insight.expenseCreated && (
                                  <Badge variant="outline" className="mt-1 text-xs bg-green-100 text-green-800 border-green-300">
                                    ✓ Expense Record Created
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {insight.senderEmail}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(insight.emailDate).toLocaleDateString()}
                          </span>
                          {insight.dueDate && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <AlertCircle className="w-3 h-3" />
                              Due: {new Date(insight.dueDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex gap-1">
                        {insight.status === 'completed' && (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteInsight(insight.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
