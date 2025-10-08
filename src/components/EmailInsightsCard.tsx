import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Mail, ChevronDown, AlertCircle, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailInsight {
  id: string;
  propertyId: string | null;
  ownerId: string | null;
  emailDate: string;
  senderEmail: string;
  subject: string;
  summary: string;
  category: string;
  actionRequired: boolean;
  dueDate: string | null;
  priority: string;
  status: string;
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
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    checkGmailConnection();
    loadInsights();
  }, [propertyId]);

  const checkGmailConnection = async () => {
    try {
      const { data } = await supabase
        .from('gmail_oauth_tokens')
        .select('id')
        .single();
      
      setGmailConnected(!!data);
    } catch (error) {
      setGmailConnected(false);
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
        actionRequired: d.action_required,
        dueDate: d.due_date,
        priority: d.priority,
        status: d.status,
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
      setConnecting(true);
      const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const REDIRECT_URI = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth`;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        access_type: 'offline',
        prompt: 'consent',
        state: user.id,
      })}`;

      window.open(authUrl, '_blank');
      toast.info('Complete authorization in the new window');
    } catch (error: any) {
      console.error('Error connecting Gmail:', error);
      toast.error('Failed to connect Gmail');
    } finally {
      setConnecting(false);
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
      default: return '📧';
    }
  };

  const actionRequiredCount = insights.filter(i => i.actionRequired && i.status === 'new').length;

  if (!gmailConnected) {
    return (
      <Card className="shadow-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Insights
          </CardTitle>
          <CardDescription>
            Connect your Gmail to automatically track property and owner communications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={connectGmail} disabled={connecting} className="w-full">
            {connecting ? 'Connecting...' : 'Connect Gmail Account'}
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
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={(e) => {
                    e.stopPropagation();
                    scanEmails();
                  }}
                  disabled={scanning}
                >
                  {scanning ? 'Scanning...' : 'Scan Now'}
                </Button>
                <ChevronDown className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <CardDescription>
              AI-powered insights from your emails (last 60 days) • Scans daily at 6 AM
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
                      
                      {insight.status === 'completed' && (
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                      )}
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
