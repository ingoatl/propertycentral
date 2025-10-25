import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OnboardingTask } from "@/types/onboarding";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home, Search, DollarSign, AlertCircle, Clock, Heart, Frown, Meh, Zap, Lightbulb, Copy, Check } from "lucide-react";
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
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      let effectiveProjectId = projectId;
      
      // If we don't have a projectId but have a propertyId, try to find the project
      if (!projectId && propertyId) {
        const { data: projectData, error: projectError } = await supabase
          .from('onboarding_projects')
          .select('id')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!projectError && projectData) {
          effectiveProjectId = projectData.id;
        }
      }
      
      // Load tasks if we have a projectId
      if (effectiveProjectId) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('onboarding_tasks')
          .select('*')
          .eq('project_id', effectiveProjectId)
          .order('phase_number', { ascending: true });

        if (tasksError) throw tasksError;
        
        console.log('PropertyDetailsModal - All tasks loaded:', tasksData?.length);
        console.log('PropertyDetailsModal - Listing URL tasks:', 
          tasksData?.filter(t => 
            t.title.toLowerCase().includes('airbnb') || 
            t.title.toLowerCase().includes('vrbo') || 
            t.title.toLowerCase().includes('direct booking') ||
            t.title.toLowerCase().includes('booking.com') ||
            t.title.toLowerCase().includes('zillow')
          )
        );
        
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

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`Copied ${fieldName}`);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const organizeTasksByCategory = (): CategorizedData => {
    const categories: CategorizedData = {
      'Owner Information': [],
      'Access & Codes': [],
      'Property Details': [],
      'Listings & Links': [],
      'Service Providers': [],
      'Utilities & Accounts': [],
      'Emergency & Safety': [],
      'Other': [], // Catch-all for uncategorized items
    };

    // Don't add property info here - it's shown in the top card
    // So we skip adding visit_price, rental_type, and address from propertyInfo

    tasks.forEach(task => {
      // Only skip if no field_value AND no description
      if (!task.field_value && !task.description) return;

      const title = task.title.toLowerCase();
      const value = task.field_value || task.description || '';

      // Skip listing URLs completely - they're shown in the top Property Information card
      // Using fuzzy matching to handle variations in task titles
      if (title.includes('airbnb') || 
          title.includes('vrbo') || 
          title.includes('direct booking') ||
          title.includes('booking page') ||
          title.includes('booking website') ||
          title.includes('booking.com') ||
          title.includes('zillow')) {
        return;
      }

      // Categorize based on title keywords
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
      } else if (title.includes('listing') || title.includes('link') || title.includes('url')) {
        // Skip other listing-related items
        return;
      } else if (title.includes('cleaner') || title.includes('maintenance') || title.includes('vendor') || title.includes('service')) {
        categories['Service Providers'].push({ label: task.title, value });
      } else if (title.includes('utility') || title.includes('electric') || title.includes('water') || title.includes('gas') || title.includes('account')) {
        categories['Utilities & Accounts'].push({ label: task.title, value });
      } else if (title.includes('emergency') || title.includes('safety') || title.includes('fire') || title.includes('alarm')) {
        categories['Emergency & Safety'].push({ label: task.title, value });
      } else {
        // Add to "Other" category instead of skipping
        categories['Other'].push({ label: task.title, value });
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  };

  // Organize tasks by phase
  const organizeTasksByPhase = () => {
    const phases: { [phaseTitle: string]: OnboardingTask[] } = {};
    
    tasks.forEach(task => {
      const phaseTitle = task.phase_title || `Phase ${task.phase_number}`;
      if (!phases[phaseTitle]) {
        phases[phaseTitle] = [];
      }
      phases[phaseTitle].push(task);
    });

    return phases;
  };

  const categorizedData = useMemo(() => organizeTasksByCategory(), [tasks, propertyInfo]);
  const phasedData = useMemo(() => organizeTasksByPhase(), [tasks]);

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

  const filteredPhases = useMemo(() => {
    if (!searchQuery) return phasedData;

    const query = searchQuery.toLowerCase();
    const filtered: { [phaseTitle: string]: OnboardingTask[] } = {};

    Object.entries(phasedData).forEach(([phaseTitle, tasks]) => {
      const matchingTasks = tasks.filter(
        task =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.field_value?.toLowerCase().includes(query)
      );

      if (matchingTasks.length > 0) {
        filtered[phaseTitle] = matchingTasks;
      }
    });

    return filtered;
  }, [phasedData, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col max-md:h-screen max-md:max-w-full max-md:p-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="max-md:text-xl">{propertyName} - Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 min-h-0 flex flex-col max-md:space-y-3">
          <div className="relative flex-shrink-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground max-md:h-5 max-md:w-5" />
            <Input
              placeholder="Search property information..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 max-md:h-12 max-md:text-base max-md:pl-10"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary max-md:h-8 max-md:w-8" />
            </div>
           ) : (
            <ScrollArea className="flex-1 min-h-0">
              <div className="space-y-4 pr-4 max-md:pr-2 max-md:space-y-3">
                {/* Property Information - Always show at top */}
                {propertyInfo && (
                  <Card className="border-2 border-primary/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Property Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Listing URLs First */}
                      {(() => {
                        // Fuzzy matching for listing platforms to handle variations
                        const airbnbTask = tasks.find(t => t.title.toLowerCase().includes('airbnb'));
                        const vrboTask = tasks.find(t => t.title.toLowerCase().includes('vrbo'));
                        const directTask = tasks.find(t => 
                          t.title.toLowerCase().includes('direct booking') || 
                          t.title.toLowerCase().includes('booking page') ||
                          t.title.toLowerCase().includes('booking website')
                        );
                        const bookingTask = tasks.find(t => t.title.toLowerCase().includes('booking.com'));
                        const zillowTask = tasks.find(t => t.title.toLowerCase().includes('zillow'));
                        
                        return (airbnbTask?.field_value || vrboTask?.field_value || directTask?.field_value || bookingTask?.field_value || zillowTask?.field_value) && (
                          <div className="pb-3 border-b border-border/50">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">Listing URLs</p>
                            <div className="space-y-2">
                              {airbnbTask?.field_value && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Airbnb</p>
                                    <a 
                                      href={airbnbTask.field_value.startsWith('http') ? airbnbTask.field_value : `https://${airbnbTask.field_value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate block"
                                    >
                                      {airbnbTask.field_value}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(airbnbTask.field_value!, "Airbnb URL")}
                                  >
                                    {copiedField === "Airbnb URL" ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                              {vrboTask?.field_value && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">VRBO</p>
                                    <a 
                                      href={vrboTask.field_value.startsWith('http') ? vrboTask.field_value : `https://${vrboTask.field_value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate block"
                                    >
                                      {vrboTask.field_value}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(vrboTask.field_value!, "VRBO URL")}
                                  >
                                    {copiedField === "VRBO URL" ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                              {directTask?.field_value && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Direct Booking Website</p>
                                    <a 
                                      href={directTask.field_value.startsWith('http') ? directTask.field_value : `https://${directTask.field_value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate block"
                                    >
                                      {directTask.field_value}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(directTask.field_value!, "Direct Booking Website")}
                                  >
                                    {copiedField === "Direct Booking Website" ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                              {bookingTask?.field_value && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Booking.com</p>
                                    <a 
                                      href={bookingTask.field_value.startsWith('http') ? bookingTask.field_value : `https://${bookingTask.field_value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate block"
                                    >
                                      {bookingTask.field_value}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(bookingTask.field_value!, "Booking.com URL")}
                                  >
                                    {copiedField === "Booking.com URL" ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                              {zillowTask?.field_value && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-muted-foreground">Zillow</p>
                                    <a 
                                      href={zillowTask.field_value.startsWith('http') ? zillowTask.field_value : `https://${zillowTask.field_value}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline truncate block"
                                    >
                                      {zillowTask.field_value}
                                    </a>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(zillowTask.field_value!, "Zillow URL")}
                                  >
                                    {copiedField === "Zillow URL" ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                      
                      {propertyInfo.visit_price && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">Visit Price</p>
                            </div>
                            <p className="text-sm ml-5 font-semibold text-primary">${propertyInfo.visit_price}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => copyToClipboard(`$${propertyInfo.visit_price}`, "Visit Price")}
                          >
                            {copiedField === "Visit Price" ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                      {propertyInfo.rental_type && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Home className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">Rental Type</p>
                            </div>
                            <p className="text-sm ml-5 capitalize">{propertyInfo.rental_type.replace('_', ' ')}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => copyToClipboard(propertyInfo.rental_type.replace('_', ' '), "Rental Type")}
                          >
                            {copiedField === "Rental Type" ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      )}
                      {propertyInfo.address && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">Address</p>
                            </div>
                            <p className="text-sm ml-5">{propertyInfo.address}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 flex-shrink-0"
                            onClick={() => copyToClipboard(propertyInfo.address, "Address")}
                          >
                            {copiedField === "Address" ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
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
                              <div key={idx} className="flex items-center justify-between gap-2 py-1">
                                <div className="flex-1 min-w-0 space-y-1">
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
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0"
                                  onClick={() => copyToClipboard(item.value, item.label)}
                                >
                                  {copiedField === item.label ? (
                                    <Check className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : null}

                {/* All Onboarding Phases - Complete View */}
                {Object.keys(filteredPhases).length > 0 && (
                  <>
                    <div className="pt-4">
                      <h3 className="text-base font-semibold mb-4">All Onboarding Phases</h3>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(filteredPhases)
                        .sort(([, tasksA], [, tasksB]) => (tasksA[0]?.phase_number || 0) - (tasksB[0]?.phase_number || 0))
                        .map(([phaseTitle, phaseTasks]) => (
                          <Card key={phaseTitle}>
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm font-semibold">
                                Phase {phaseTasks[0]?.phase_number}: {phaseTitle}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {phaseTasks.map((task) => {
                                const labelMatch = searchQuery && task.title.toLowerCase().includes(searchQuery.toLowerCase());
                                const valueMatch = searchQuery && (
                                  task.field_value?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  task.description?.toLowerCase().includes(searchQuery.toLowerCase())
                                );
                                
                                return (
                                  <div key={task.id} className={`space-y-1.5 pb-2 border-b last:border-b-0 ${valueMatch || labelMatch ? 'bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded' : ''}`}>
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-xs font-medium">
                                        {labelMatch ? (
                                          <span className="bg-yellow-200 dark:bg-yellow-900">{task.title}</span>
                                        ) : (
                                          task.title
                                        )}
                                      </p>
                                      {task.status && (
                                        <Badge 
                                          variant={task.status === 'completed' ? 'default' : 'secondary'}
                                          className="text-xs"
                                        >
                                          {task.status}
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {task.description && (
                                      <p className="text-xs text-muted-foreground italic">
                                        {task.description}
                                      </p>
                                    )}
                                    
                                    {task.field_value && (
                                      <div className="text-sm break-words pl-2 border-l-2 border-primary/30">
                                        {isUrl(task.field_value) ? (
                                          <a 
                                            href={task.field_value.startsWith('http') ? task.field_value : `https://${task.field_value}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline inline-flex items-center gap-1"
                                          >
                                            {valueMatch ? (
                                              <span className="bg-yellow-200 dark:bg-yellow-900">{task.field_value}</span>
                                            ) : (
                                              task.field_value
                                            )}
                                            <LinkIcon className="h-3 w-3" />
                                          </a>
                                        ) : valueMatch ? (
                                          <span className="bg-yellow-200 dark:bg-yellow-900">{task.field_value}</span>
                                        ) : (
                                          task.field_value
                                        )}
                                      </div>
                                    )}
                                    
                                    {task.assigned_to && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        Assigned to: {task.assigned_to}
                                      </p>
                                    )}
                                    
                                    {task.due_date && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Due: {new Date(task.due_date).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </>
                )}
                
                {/* Empty State */}
                {searchQuery && Object.keys(filteredData).length === 0 && Object.keys(filteredPhases).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No results found for "{searchQuery}"
                  </div>
                ) : !searchQuery && Object.keys(filteredData).length === 0 && Object.keys(filteredPhases).length === 0 && !propertyInfo && (
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
