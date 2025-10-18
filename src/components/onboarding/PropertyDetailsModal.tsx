import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { OnboardingTask } from "@/types/onboarding";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home, Search, DollarSign } from "lucide-react";
import { toast } from "sonner";

interface PropertyDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
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

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const { data: tasksData, error: tasksError } = await supabase
        .from('onboarding_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('phase_number', { ascending: true });

      if (tasksError) throw tasksError;
      setTasks((tasksData || []) as OnboardingTask[]);

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
      }
    } catch (error: any) {
      console.error('Error loading property details:', error);
      toast.error('Failed to load property information');
    } finally {
      setLoading(false);
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
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{propertyName} - Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
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
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
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
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No property information completed yet. Complete onboarding tasks to see details here.
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
