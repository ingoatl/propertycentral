import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { OnboardingTask } from "@/types/onboarding";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home, Search, DollarSign, AlertCircle, Clock, Heart, Frown, Meh, Zap, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface PropertyDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  propertyName: string;
  propertyId?: string;
}

interface CategorizedData {
  [category: string]: { label: string; value: string; icon?: any }[];
}

export function PropertyDetailsModal({ open, onOpenChange, projectId, propertyName, propertyId }: PropertyDetailsModalProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyInfo, setPropertyInfo] = useState<any>(null);
  const [emailInsights, setEmailInsights] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Only load tasks if projectId exists
      if (projectId) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('onboarding_tasks')
          .select('*')
          .eq('project_id', projectId)
          .order('phase_number', { ascending: true });

        if (tasksError) throw tasksError;
        setTasks((tasksData || []) as OnboardingTask[]);
      }
      // Load property info if propertyId is available
      if (propertyId) {
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .single();

        if (propertyError) {
          console.error('Error loading property:', propertyError);
        } else {
          setPropertyInfo(propertyData);
        }

        // Load email insights for this property
        const { data: insightsData, error: insightsError } = await supabase
          .from('email_insights')
          .select('*')
          .eq('property_id', propertyId)
          .order('email_date', { ascending: false })
          .limit(50);

        if (insightsError) {
          console.error('Error loading insights:', insightsError);
        } else {
          // Filter out Amazon and booking platform emails
          const filteredInsights = (insightsData || []).filter(insight => {
            const senderEmail = insight.sender_email?.toLowerCase() || '';
            const category = insight.category?.toLowerCase() || '';
            
            // Exclude Amazon emails
            if (senderEmail.includes('amazon.com') || 
                senderEmail.includes('amazon.') ||
                senderEmail.includes('amzn.')) {
              return false;
            }
            
            // Exclude booking platform emails
            if (senderEmail.includes('booking.com') ||
                senderEmail.includes('airbnb.com') ||
                senderEmail.includes('vrbo.com') ||
                senderEmail.includes('expedia.com') ||
                category === 'booking') {
              return false;
            }
            
            // Include all other emails (transactional, organizational, vendor emails)
            return true;
          }).slice(0, 10); // Limit to 10 after filtering
          
          setEmailInsights(filteredInsights);
        }
      }
    } catch (error: any) {
      console.error('Error loading property details:', error);
      toast.error('Failed to load property information');
    } finally {
      setLoading(false);
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
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

  const isUrl = (text: string): boolean => {
    try {
      new URL(text);
      return true;
    } catch {
      return text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.');
    }
  };

  const organizeTasksByCategory = (): CategorizedData => {
    const categories: CategorizedData = {
      'Property Information': [],
      'Owner Information': [],
      'Access & Codes': [],
      'Property Details': [],
      'Listings & Links': [],
      'Service Providers': [],
      'Utilities & Accounts': [],
      'Emergency & Safety': [],
    };

    // Add property info first
    if (propertyInfo) {
      if (propertyInfo.visit_price) {
        categories['Property Information'].push({ 
          label: 'Visit Price', 
          value: `$${propertyInfo.visit_price}`,
          icon: DollarSign 
        });
      }
      if (propertyInfo.rental_type) {
        categories['Property Information'].push({ 
          label: 'Rental Type', 
          value: propertyInfo.rental_type,
          icon: Home 
        });
      }
      if (propertyInfo.address) {
        categories['Property Information'].push({ 
          label: 'Address', 
          value: propertyInfo.address,
          icon: MapPin 
        });
      }
    }

    tasks.forEach(task => {
      if (!task.field_value) return;

      const title = task.title.toLowerCase();
      const value = task.field_value;

      if (title.includes('owner') || title.includes('contact')) {
        if (title.includes('email')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Mail });
        } else if (title.includes('phone')) {
          categories['Owner Information'].push({ label: task.title, value, icon: Phone });
        } else if (title.includes('name')) {
          categories['Owner Information'].push({ label: task.title, value, icon: User });
        } else {
          categories['Owner Information'].push({ label: task.title, value });
        }
      } else if (title.includes('code') || title.includes('password') || title.includes('wifi') || title.includes('lock') || title.includes('gate')) {
        categories['Access & Codes'].push({ label: task.title, value, icon: Lock });
      } else if (title.includes('address') || title.includes('bedroom') || title.includes('bathroom') || title.includes('parking')) {
        if (title.includes('address')) {
          categories['Property Details'].push({ label: task.title, value, icon: MapPin });
        } else {
          categories['Property Details'].push({ label: task.title, value, icon: Home });
        }
      } else if (title.includes('listing') || title.includes('airbnb') || title.includes('vrbo') || title.includes('link') || title.includes('url')) {
        categories['Listings & Links'].push({ label: task.title, value, icon: LinkIcon });
      } else if (title.includes('cleaner') || title.includes('maintenance') || title.includes('vendor') || title.includes('service')) {
        categories['Service Providers'].push({ label: task.title, value });
      } else if (title.includes('utility') || title.includes('electric') || title.includes('water') || title.includes('gas') || title.includes('account')) {
        categories['Utilities & Accounts'].push({ label: task.title, value });
      } else if (title.includes('emergency') || title.includes('safety') || title.includes('fire') || title.includes('alarm')) {
        categories['Emergency & Safety'].push({ label: task.title, value });
      }
    });

    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  const categorizedData = useMemo(() => organizeTasksByCategory(), [tasks]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return categorizedData;

    const query = searchQuery.toLowerCase();
    const filtered: CategorizedData = {};

    Object.entries(categorizedData).forEach(([category, items]) => {
      const matchingItems = items.filter(
        item =>
          item.label.toLowerCase().includes(query) ||
          item.value.toLowerCase().includes(query)
      );

      if (matchingItems.length > 0) {
        filtered[category] = matchingItems;
      }
    });

    return filtered;
  }, [categorizedData, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{propertyName} - Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 min-h-0 flex flex-col">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search property information..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
           ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 pr-4">
                {/* Property Information - Always show at top */}
                {propertyInfo && (
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Property Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {propertyInfo.visit_price && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">Visit Price</p>
                          </div>
                          <p className="text-sm ml-5 font-semibold text-primary">${propertyInfo.visit_price}</p>
                        </div>
                      )}
                      {propertyInfo.rental_type && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Home className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">Rental Type</p>
                          </div>
                          <p className="text-sm ml-5 capitalize">{propertyInfo.rental_type.replace('_', ' ')}</p>
                        </div>
                      )}
                      {propertyInfo.address && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                            <p className="text-xs font-medium text-muted-foreground">Address</p>
                          </div>
                          <p className="text-sm ml-5">{propertyInfo.address}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Onboarding Details Sections */}
                {Object.keys(filteredData).length > 0 ? (
                  <div className="grid gap-4">
                    {Object.entries(filteredData).map(([category, items]) => (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold">{category}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {items.map((item, idx) => {
                            const Icon = item.icon;
                            const labelMatch = searchQuery && item.label.toLowerCase().includes(searchQuery.toLowerCase());
                            const valueMatch = searchQuery && item.value.toLowerCase().includes(searchQuery.toLowerCase());
                            
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {labelMatch ? (
                                      <span className="bg-yellow-200 dark:bg-yellow-900">{item.label}</span>
                                    ) : (
                                      item.label
                                    )}
                                  </p>
                                </div>
                                <div className="text-sm ml-5 break-words">
                                  {isUrl(item.value) ? (
                                    <a 
                                      href={item.value.startsWith('http') ? item.value : `https://${item.value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      {valueMatch ? (
                                        <span className="bg-yellow-200 dark:bg-yellow-900">{item.value}</span>
                                      ) : (
                                        item.value
                                      )}
                                      <LinkIcon className="h-3 w-3" />
                                    </a>
                                  ) : valueMatch ? (
                                    <span className="bg-yellow-200 dark:bg-yellow-900">{item.value}</span>
                                  ) : (
                                    item.value
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : searchQuery ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No results found for "{searchQuery}"
                  </div>
                ) : !propertyInfo && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No property information completed yet. Complete onboarding tasks to see details here.
                  </div>
                )}

                {/* Email Insights Section - At Bottom */}
                {emailInsights.length > 0 && (
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email Insights ({emailInsights.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {emailInsights.map((insight) => (
                        <div key={insight.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{getCategoryIcon(insight.category)}</span>
                            <Badge variant="outline" className="capitalize text-xs">
                              {insight.category.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${getPriorityColor(insight.priority)}`}>
                              {insight.priority}
                            </Badge>
                            {insight.action_required && insight.status === 'new' && (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <AlertCircle className="w-3 h-3" />
                                Action Required
                              </Badge>
                            )}
                          </div>
                          
                          <p className="font-medium text-sm line-clamp-1">{insight.subject}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{insight.summary}</p>
                          
                          {insight.sentiment && (
                            <div className="flex items-center gap-2">
                              {getSentimentIcon(insight.sentiment)}
                              <Badge variant="outline" className="capitalize text-xs">
                                {insight.sentiment}
                              </Badge>
                            </div>
                          )}

                          {insight.suggested_actions && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded border border-blue-200 dark:border-blue-800">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="space-y-1">
                                  <p className="text-xs font-medium text-blue-900 dark:text-blue-100">Suggested Actions:</p>
                                  <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-0.5">
                                    {insight.suggested_actions.split(',').map((action: string, idx: number) => (
                                      <li key={idx}>• {action.trim()}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}

                          {insight.expense_detected && (
                            <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded border border-green-200 dark:border-green-800">
                              <div className="flex items-start gap-2">
                                <DollarSign className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-green-900 dark:text-green-100">
                                    Expense: ${insight.expense_amount?.toFixed(2)}
                                  </p>
                                  {insight.expense_description && (
                                    <p className="text-xs text-green-800 dark:text-green-200">{insight.expense_description}</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {insight.sender_email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(insight.email_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
