import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle2, 
  Activity,
  RefreshCw,
  TrendingUp,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface CircuitBreakerData {
  service_name: string;
  state: string;
  failure_count: number;
  success_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  last_error_message: string | null;
}

interface ComplianceStats {
  total: number;
  blocked: number;
  modified: number;
  escalated: number;
  sent: number;
  topIssues: Array<{ phrase: string; count: number; category: string }>;
}

type CircuitState = 'closed' | 'open' | 'half_open';

function getCircuitState(state: string): CircuitState {
  if (state === 'open' || state === 'half_open') return state;
  return 'closed';
}

export function ComplianceWatchdogCard() {
  const [activeTab, setActiveTab] = useState("fair-housing");

  // Fetch compliance stats (last 24h)
  const { data: complianceStats, isLoading: loadingCompliance } = useQuery({
    queryKey: ['compliance-stats'],
    queryFn: async (): Promise<ComplianceStats> => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data, error } = await supabase
        .from('compliance_message_log')
        .select('action_taken, fh_blocked_phrases, fh_issues')
        .gte('created_at', yesterday.toISOString());

      if (error) throw error;

      const stats: ComplianceStats = {
        total: data?.length || 0,
        blocked: data?.filter(d => d.action_taken === 'blocked').length || 0,
        modified: data?.filter(d => d.action_taken === 'modified').length || 0,
        escalated: data?.filter(d => d.action_taken === 'escalated').length || 0,
        sent: data?.filter(d => d.action_taken === 'sent').length || 0,
        topIssues: []
      };

      // Calculate top issues
      const issueMap = new Map<string, { count: number; category: string }>();
      data?.forEach(log => {
        const blockedPhrases = log.fh_blocked_phrases || [];
        const issues = (log.fh_issues as any[]) || [];
        
        blockedPhrases.forEach((phrase: string) => {
          const existing = issueMap.get(phrase);
          const issue = issues.find((i: any) => i.phrase === phrase);
          if (existing) {
            existing.count++;
          } else {
            issueMap.set(phrase, { count: 1, category: issue?.category || 'unknown' });
          }
        });
      });

      stats.topIssues = Array.from(issueMap.entries())
        .map(([phrase, data]) => ({ phrase, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return stats;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch circuit breaker status
  const { data: circuitBreakers, isLoading: loadingCircuits, refetch: refetchCircuits } = useQuery({
    queryKey: ['circuit-breakers'],
    queryFn: async (): Promise<CircuitBreakerData[]> => {
      const { data, error } = await supabase
        .from('ai_circuit_breaker')
        .select('*')
        .order('service_name');

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const handleResetCircuit = async (serviceName: string) => {
    await supabase
      .from('ai_circuit_breaker')
      .update({
        state: 'closed',
        failure_count: 0,
        success_count: 0,
        opened_at: null,
        half_open_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('service_name', serviceName);
    
    refetchCircuits();
  };

  const allCircuitsClosed = circuitBreakers?.every(cb => cb.state === 'closed');
  const overallHealth = allCircuitsClosed ? 'healthy' : 
    circuitBreakers?.some(cb => cb.state === 'open') ? 'degraded' : 'recovering';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Compliance & AI Health</CardTitle>
          </div>
          <Badge 
            variant={overallHealth === 'healthy' ? 'default' : overallHealth === 'degraded' ? 'destructive' : 'secondary'}
            className="gap-1"
          >
            {overallHealth === 'healthy' && <CheckCircle2 className="h-3 w-3" />}
            {overallHealth === 'degraded' && <AlertTriangle className="h-3 w-3" />}
            {overallHealth === 'recovering' && <Activity className="h-3 w-3" />}
            {overallHealth === 'healthy' ? 'All Systems Healthy' : 
             overallHealth === 'degraded' ? 'Service Degraded' : 'Recovering'}
          </Badge>
        </div>
        <CardDescription>
          Fair Housing compliance and AI service reliability monitoring
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fair-housing" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Fair Housing
            </TabsTrigger>
            <TabsTrigger value="ai-health" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              AI Health
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="fair-housing" className="mt-4 space-y-4">
            {loadingCompliance ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard 
                    label="Scanned" 
                    value={complianceStats?.total || 0} 
                    icon={<TrendingUp className="h-4 w-4" />}
                    color="blue"
                  />
                  <StatCard 
                    label="Blocked" 
                    value={complianceStats?.blocked || 0} 
                    icon={<AlertTriangle className="h-4 w-4" />}
                    color="red"
                  />
                  <StatCard 
                    label="Modified" 
                    value={complianceStats?.modified || 0} 
                    icon={<Activity className="h-4 w-4" />}
                    color="yellow"
                  />
                  <StatCard 
                    label="Escalated" 
                    value={complianceStats?.escalated || 0} 
                    icon={<Shield className="h-4 w-4" />}
                    color="purple"
                  />
                </div>
                
                {/* Top Issues */}
                {complianceStats?.topIssues && complianceStats.topIssues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Most Common Issues (24h)
                    </p>
                    <div className="space-y-2">
                      {complianceStats.topIssues.map((issue, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {issue.category.replace('_', ' ')}
                            </Badge>
                            <span className="text-sm">"{issue.phrase}"</span>
                          </div>
                          <Badge variant="secondary">{issue.count}×</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {complianceStats?.total === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No compliance issues in the last 24 hours</p>
                  </div>
                )}
              </>
            )}
          </TabsContent>
          
          <TabsContent value="ai-health" className="mt-4 space-y-4">
            {loadingCircuits ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {circuitBreakers?.map((cb) => (
                  <CircuitBreakerCard 
                    key={cb.service_name} 
                    data={cb} 
                    onReset={() => handleResetCircuit(cb.service_name)}
                  />
                ))}
                
                {(!circuitBreakers || circuitBreakers.length === 0) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2" />
                    <p>No circuit breakers configured</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function StatCard({ 
  label, 
  value, 
  icon, 
  color 
}: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600',
    red: 'bg-red-500/10 text-red-600',
    yellow: 'bg-yellow-500/10 text-yellow-600',
    purple: 'bg-purple-500/10 text-purple-600'
  };

  return (
    <div className="p-3 rounded-lg bg-muted/50 text-center">
      <div className={cn("w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1", colorClasses[color])}>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function CircuitBreakerCard({ 
  data, 
  onReset 
}: { 
  data: CircuitBreakerData; 
  onReset: () => void;
}) {
  const circuitState = getCircuitState(data.state);
  
  const stateColors: Record<CircuitState, string> = {
    closed: 'bg-green-600',
    open: 'bg-destructive',
    half_open: 'bg-amber-500'
  };

  const stateLabels: Record<CircuitState, string> = {
    closed: 'Healthy',
    open: 'Circuit Open',
    half_open: 'Recovering'
  };

  return (
    <div className="p-3 rounded-lg border bg-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("w-2.5 h-2.5 rounded-full", stateColors[circuitState])} />
          <span className="font-medium text-sm">{data.service_name}</span>
        </div>
        <Badge variant={circuitState === 'closed' ? 'secondary' : 'destructive'}>
          {stateLabels[circuitState]}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-2">
        <div>Failures: {data.failure_count}</div>
        <div>Successes: {data.success_count}</div>
        {data.last_success_at && (
          <div>Last success: {formatDistanceToNow(new Date(data.last_success_at), { addSuffix: true })}</div>
        )}
        {data.last_failure_at && (
          <div>Last failure: {formatDistanceToNow(new Date(data.last_failure_at), { addSuffix: true })}</div>
        )}
      </div>
      
      {data.last_error_message && (
        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded mb-2 truncate">
          {data.last_error_message}
        </p>
      )}
      
      {circuitState !== 'closed' && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReset}
          className="w-full gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          Reset Circuit
        </Button>
      )}
    </div>
  );
}
