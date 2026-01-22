import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingTask } from "@/types/onboarding";
import { Loader2, MapPin, User, Lock, Phone, Link as LinkIcon, Mail, Home, DollarSign, AlertCircle, Clock, Heart, Frown, Meh, Zap, Lightbulb, Copy, Check, TrendingUp, FileText, ExternalLink, ClipboardCheck, Key, Settings, Car, Bed, ChevronDown, ChevronUp, Download, MessageSquare, Plus, ArrowRight, ListTodo, Info, AlertTriangle, FolderOpen, Eye, FileSpreadsheet, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import { InspectionDataSection } from "@/components/properties/InspectionDataSection";
import { MaintenanceBookTab } from "@/components/properties/MaintenanceBookTab";
import { ONBOARDING_PHASES } from "@/context/onboardingPhases";
import { DocumentViewer } from "@/components/documents/DocumentViewer";
import { ModalSkeleton } from "@/components/ui/modal-skeleton";
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

interface FinancialData {
  last_year_revenue: number | null;
  average_daily_rate: number | null;
  occupancy_rate: number | null;
  average_booking_window: number | null;
  average_monthly_revenue: number | null;
  peak_season: string | null;
  peak_season_adr: number | null;
  revenue_statement_url: string | null;
  expense_report_url: string | null;
  airbnb_revenue_export_url: string | null;
  vrbo_revenue_export_url: string | null;
  ownerrez_revenue_export_url: string | null;
  pricing_revenue_goals: string | null;
  competitor_insights: string | null;
}

export function PropertyDetailsModal({ open, onOpenChange, projectId, propertyName, propertyId }: PropertyDetailsModalProps) {
  const [tasks, setTasks] = useState<OnboardingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [criticalDataLoaded, setCriticalDataLoaded] = useState(false); // Phase 1: critical data
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyInfo, setPropertyInfo] = useState<any>(null);
  const [emailInsights, setEmailInsights] = useState<any[]>([]);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [intelItems, setIntelItems] = useState<any[]>([]);
  const [credentials, setCredentials] = useState<any[]>([]);
  const [appliances, setAppliances] = useState<any[]>([]);
  const [ownerActions, setOwnerActions] = useState<any[]>([]);
  const [ownerDocuments, setOwnerDocuments] = useState<any[]>([]);
  const [propertyDocuments, setPropertyDocuments] = useState<any[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [convertingTaskId, setConvertingTaskId] = useState<string | null>(null);
  const [onboardingProject, setOnboardingProject] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [viewerDoc, setViewerDoc] = useState<{ path: string; name: string; type?: string } | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
    } else {
      // Reset loading states when modal closes
      setCriticalDataLoaded(false);
    }
  }, [open, projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setCriticalDataLoaded(false);
      
      let effectiveProjectId = projectId;
      
      // If we don't have a projectId but have a propertyId, try to find the project
      if (!projectId && propertyId) {
        const { data: projectData, error: projectError } = await supabase
          .from('onboarding_projects')
          .select('*')
          .eq('property_id', propertyId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!projectError && projectData) {
          effectiveProjectId = projectData.id;
          setOnboardingProject(projectData);
        }
      } else if (projectId) {
        const { data: projectData } = await supabase
          .from('onboarding_projects')
          .select('*')
          .eq('id', projectId)
          .maybeSingle();
        if (projectData) {
          setOnboardingProject(projectData);
        }
      }
      
      // PHASE 1: Load critical data first (property info, tasks, project)
      const criticalPromises: Promise<any>[] = [];
      
      // Tasks query - critical
      if (effectiveProjectId) {
        criticalPromises.push(
          (async () => {
            const { data, error } = await supabase
              .from('onboarding_tasks')
              .select('id, project_id, phase_number, phase_title, title, description, field_type, field_value, status, due_date, assigned_to_uuid')
              .eq('project_id', effectiveProjectId)
              .order('phase_number', { ascending: true });
            if (!error) setTasks((data || []) as OnboardingTask[]);
          })()
        );
      }
      
      // Property info - critical
      if (propertyId) {
        criticalPromises.push(
          (async () => {
            const { data } = await supabase
              .from('properties')
              .select('id, name, address, bedrooms, bathrooms, max_guests, airbnb_url, vrbo_url, direct_booking_url, status')
              .eq('id', propertyId)
              .maybeSingle();
            if (data) setPropertyInfo(data);
          })()
        );
      }
      
      // Wait for critical data to load first
      await Promise.all(criticalPromises);
      setCriticalDataLoaded(true);
      
      // PHASE 2: Load secondary data in background (don't block UI)
      const secondaryPromises: Promise<any>[] = [];
      
      if (propertyId) {
        // Email insights (limited) - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('email_insights')
              .select('id, subject, summary, category, priority, email_date, sender_email')
              .eq('property_id', propertyId)
              .order('email_date', { ascending: false })
              .limit(20);
            const filteredInsights = (data || []).filter(insight => {
              const senderEmail = insight.sender_email?.toLowerCase() || '';
              const category = insight.category?.toLowerCase() || '';
              if (senderEmail.includes('amazon.com') || senderEmail.includes('amazon.') || senderEmail.includes('amzn.')) return false;
              if (senderEmail.includes('booking.com') || senderEmail.includes('airbnb.com') || senderEmail.includes('vrbo.com') || senderEmail.includes('expedia.com') || category === 'booking') return false;
              return true;
            }).slice(0, 10);
            setEmailInsights(filteredInsights);
          })()
        );

        // Financial data - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('property_financial_data')
              .select('*')
              .eq('property_id', propertyId)
              .maybeSingle();
            if (data) setFinancialData(data as FinancialData);
          })()
        );

        // Property intel items - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('property_intel_items')
              .select('*')
              .eq('property_id', propertyId)
              .eq('is_visible', true)
              .order('category', { ascending: true });
            setIntelItems(data || []);
          })()
        );

        // Credentials - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('property_credentials')
              .select('*')
              .eq('property_id', propertyId);
            setCredentials(data || []);
          })()
        );

        // Appliances - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('property_appliances')
              .select('*')
              .eq('property_id', propertyId);
            setAppliances(data || []);
          })()
        );

        // Owner conversation actions - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('owner_conversation_actions')
              .select(`*, owner_conversations!inner(property_id, title)`)
              .eq('owner_conversations.property_id', propertyId)
              .in('status', ['created', 'suggested'])
              .order('action_type', { ascending: true });
            setOwnerActions(data || []);
          })()
        );

        // Owner documents - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('owner_conversation_documents')
              .select(`*, owner_conversations!inner(property_id, title)`)
              .eq('owner_conversations.property_id', propertyId);
            setOwnerDocuments(data || []);
          })()
        );

        // Property documents - secondary
        secondaryPromises.push(
          (async () => {
            const { data } = await supabase
              .from('property_documents')
              .select('*')
              .eq('property_id', propertyId)
              .order('created_at', { ascending: false });
            setPropertyDocuments(data || []);
          })()
        );
      }
      
      // Load secondary data in background - don't await to not block UI
      Promise.all(secondaryPromises).catch(err => {
        console.error('Error loading secondary data:', err);
      });
      
    } catch (error: any) {
      console.error('Error loading property details:', error);
      toast.error('Failed to load property information');
    } finally {
      setLoading(false);
    }
  };

  // Function to auto-create onboarding project if missing
  const ensureOnboardingProject = async (): Promise<string | null> => {
    if (onboardingProject?.id) return onboardingProject.id;
    
    if (!propertyId) {
      toast.error('Property ID is required to create an onboarding project');
      return null;
    }

    try {
      // Create new project
      const { data: newProject, error: createError } = await supabase
        .from('onboarding_projects')
        .insert({
          property_id: propertyId,
          owner_name: propertyName || 'Unknown Owner',
          property_address: propertyInfo?.address || propertyName,
          status: 'pending',
          progress: 0
        })
        .select()
        .single();

      if (createError) throw createError;

      // Create default tasks from ONBOARDING_PHASES
      const tasksToInsert = ONBOARDING_PHASES.flatMap(phase => 
        phase.tasks.map(task => ({
          project_id: newProject.id,
          phase_number: phase.id,
          phase_title: phase.title,
          title: task.title,
          description: task.description || '',
          field_type: task.field_type,
          status: 'pending'
        }))
      );

      if (tasksToInsert.length > 0) {
        await supabase.from('onboarding_tasks').insert(tasksToInsert);
      }

      setOnboardingProject(newProject);
      toast.success('Created onboarding project');
      return newProject.id;
    } catch (error) {
      console.error('Error creating onboarding project:', error);
      toast.error('Failed to create onboarding project');
      return null;
    }
  };

  // Function to convert an owner action to an onboarding task
  const convertToOnboardingTask = async (action: any) => {
    setConvertingTaskId(action.id);
    
    try {
      const projectIdToUse = await ensureOnboardingProject();
      if (!projectIdToUse) {
        setConvertingTaskId(null);
        return;
      }

      // Create the onboarding task
      const { data: newTask, error: taskError } = await supabase
        .from('onboarding_tasks')
        .insert({
          project_id: projectIdToUse,
          phase_number: 1,
          phase_title: 'Setup & Configuration',
          title: action.title,
          description: action.description || '',
          field_type: 'checkbox',
          status: 'pending'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Update the action status to indicate it's been converted
      await supabase
        .from('owner_conversation_actions')
        .update({ 
          status: 'created',
          linked_task_id: newTask.id 
        })
        .eq('id', action.id);

      // Refresh the data
      loadData();
      toast.success(`Task "${action.title}" created successfully`);
    } catch (error) {
      console.error('Error converting to task:', error);
      toast.error('Failed to create task');
    } finally {
      setConvertingTaskId(null);
    }
  };

  // Separate owner actions by type
  const separatedOwnerActions = useMemo(() => {
    const propertyInfoActions = ownerActions.filter(a => a.action_type === 'property_info');
    const taskActions = ownerActions.filter(a => a.action_type === 'task');
    const setupNotes = ownerActions.filter(a => a.action_type === 'setup_note');
    const credentialActions = ownerActions.filter(a => a.action_type === 'credential');
    const faqActions = ownerActions.filter(a => a.action_type === 'faq');
    const otherActions = ownerActions.filter(a => 
      !['property_info', 'task', 'setup_note', 'credential', 'faq'].includes(a.action_type)
    );
    
    return { propertyInfoActions, taskActions, setupNotes, credentialActions, faqActions, otherActions };
  }, [ownerActions]);

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

  // Highlight matching text in search results
  const highlightText = useCallback((text: string, query: string) => {
    if (!query || !text) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">{part}</mark>
        : part
    );
  }, []);

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

  // Organize owner actions by category
  const organizedOwnerIntel = useMemo(() => {
    const categoryMap: Record<string, any[]> = {};
    const categoryIcons: Record<string, any> = {
      'Access': Lock,
      'Parking': Car,
      'Amenities': Bed,
      'Safety': AlertCircle,
      'Cleaning': Home,
      'Maintenance': Settings,
      'Policies': FileText,
      'Operations': ClipboardCheck,
      'Utilities': Zap,
    };
    const categoryOrder = ['Access', 'Parking', 'Amenities', 'Safety', 'Cleaning', 'Utilities', 'Maintenance', 'Operations', 'Policies'];
    
    ownerActions.forEach(action => {
      const cat = action.category || 'Other';
      if (!categoryMap[cat]) {
        categoryMap[cat] = [];
      }
      categoryMap[cat].push(action);
    });

    // Sort categories by predefined order
    const sortedCategories = Object.keys(categoryMap).sort((a, b) => {
      const aIndex = categoryOrder.indexOf(a);
      const bIndex = categoryOrder.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    return { categoryMap, categoryIcons, sortedCategories };
  }, [ownerActions]);

  // Filter owner intel based on search
  const filteredOwnerIntel = useMemo(() => {
    if (!searchQuery) return organizedOwnerIntel;
    
    const query = searchQuery.toLowerCase();
    const filteredMap: Record<string, any[]> = {};
    
    organizedOwnerIntel.sortedCategories.forEach(cat => {
      const items = organizedOwnerIntel.categoryMap[cat].filter((item: any) => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        JSON.stringify(item.content)?.toLowerCase().includes(query)
      );
      if (items.length > 0) {
        filteredMap[cat] = items;
      }
    });

    return {
      ...organizedOwnerIntel,
      categoryMap: filteredMap,
      sortedCategories: Object.keys(filteredMap)
    };
  }, [organizedOwnerIntel, searchQuery]);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

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

  // Aggregated search results for immediate display at top
  const aggregatedSearchResults = useMemo(() => {
    if (!searchQuery) return [];
    
    const query = searchQuery.toLowerCase();
    const results: Array<{type: string; label: string; value: string; source: string; icon?: any}> = [];
    
    // Search property info
    if (propertyInfo?.address?.toLowerCase().includes(query)) {
      results.push({type: 'property', label: 'Address', value: propertyInfo.address, source: 'Property Info', icon: MapPin});
    }
    if (propertyInfo?.visit_price?.toString().includes(query)) {
      results.push({type: 'property', label: 'Visit Price', value: `$${propertyInfo.visit_price}`, source: 'Property Info', icon: DollarSign});
    }
    if (propertyInfo?.rental_type?.toLowerCase().includes(query)) {
      results.push({type: 'property', label: 'Rental Type', value: propertyInfo.rental_type, source: 'Property Info', icon: Home});
    }
    
    // Search tasks with field values
    tasks.forEach(task => {
      const titleMatch = task.title.toLowerCase().includes(query);
      const valueMatch = task.field_value?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      
      if ((titleMatch || valueMatch || descMatch) && (task.field_value || task.description)) {
        results.push({
          type: 'task',
          label: task.title,
          value: task.field_value || task.description || '',
          source: task.phase_title || `Phase ${task.phase_number}`,
          icon: task.title.toLowerCase().includes('phone') ? Phone :
                task.title.toLowerCase().includes('email') ? Mail :
                task.title.toLowerCase().includes('address') ? MapPin :
                task.title.toLowerCase().includes('code') || task.title.toLowerCase().includes('password') ? Lock :
                FileText
        });
      }
    });
    
    // Search owner actions
    ownerActions.forEach(action => {
      const titleMatch = action.title?.toLowerCase().includes(query);
      const descMatch = action.description?.toLowerCase().includes(query);
      const contentMatch = JSON.stringify(action.content)?.toLowerCase().includes(query);
      
      if (titleMatch || descMatch || contentMatch) {
        results.push({
          type: 'owner_action',
          label: action.title || 'Owner Info',
          value: action.description || JSON.stringify(action.content) || '',
          source: action.category || 'Owner Intel',
          icon: Info
        });
      }
    });
    
    // Search financial data
    if (financialData) {
      if (financialData.last_year_revenue?.toString().includes(query)) {
        results.push({type: 'financial', label: 'Last Year Revenue', value: `$${financialData.last_year_revenue.toLocaleString()}`, source: 'Financial Data', icon: DollarSign});
      }
      if (financialData.average_daily_rate?.toString().includes(query)) {
        results.push({type: 'financial', label: 'Average Daily Rate', value: `$${financialData.average_daily_rate}`, source: 'Financial Data', icon: TrendingUp});
      }
    }
    
    return results;
  }, [searchQuery, propertyInfo, tasks, ownerActions, financialData]);

  // Total search result count
  const totalResultCount = useMemo(() => {
    return aggregatedSearchResults.length;
  }, [aggregatedSearchResults]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col max-md:h-screen max-md:max-w-full max-md:p-4">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="max-md:text-xl">{propertyName} - Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 flex-1 min-h-0 flex flex-col max-md:space-y-3">
          <div className="relative flex-shrink-0">
            <Input
              placeholder="Search property information..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-24"
            />
            {searchQuery && (
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                <Badge 
                  variant={totalResultCount > 0 ? "default" : "secondary"} 
                  className="text-xs"
                >
                  {totalResultCount > 0 ? `${totalResultCount} found` : 'No results'}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {loading && !criticalDataLoaded ? (
            <ModalSkeleton variant="property-details" />
           ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
                <TabsTrigger value="details" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="maintenance" className="flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  Maintenance
                </TabsTrigger>
                <TabsTrigger value="documents" className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Docs
                  {propertyDocuments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {propertyDocuments.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-4 max-md:pr-2 max-md:space-y-3">
                    {/* Search Results - Show at top when searching */}
                    {searchQuery && aggregatedSearchResults.length > 0 && (
                      <Card className="border-2 border-yellow-500 bg-yellow-50/50 dark:bg-yellow-900/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                            Search Results ({aggregatedSearchResults.length})
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {aggregatedSearchResults.map((result, idx) => {
                            const IconComponent = result.icon;
                            return (
                              <div 
                                key={idx} 
                                className="p-3 bg-background rounded-lg border border-yellow-300 dark:border-yellow-700 flex items-start gap-3"
                              >
                                {IconComponent && (
                                  <IconComponent className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {result.source}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-medium">
                                    {highlightText(result.label, searchQuery)}
                                  </p>
                                  <p className="text-sm text-muted-foreground break-words">
                                    {highlightText(result.value, searchQuery)}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 flex-shrink-0"
                                  onClick={() => copyToClipboard(result.value, result.label)}
                                >
                                  {copiedField === result.label ? (
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
                    )}

                    {/* No results message */}
                    {searchQuery && aggregatedSearchResults.length === 0 && (
                      <Card className="border-2 border-muted">
                        <CardContent className="py-8 text-center">
                          <p className="text-muted-foreground">No results found for "{searchQuery}"</p>
                          <Button 
                            variant="link" 
                            className="mt-2"
                            onClick={() => setSearchQuery("")}
                          >
                            Clear search
                          </Button>
                        </CardContent>
                      </Card>
                    )}

                    {/* Property Information - Always show at top (hidden when searching) */}
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
                                      className="text-xs max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
                                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >
                                      {airbnbTask.field_value}
                                    </a>
                                  </div>
                                   <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                                    onClick={() => copyToClipboard(airbnbTask.field_value!, "Airbnb URL")}
                                  >
                                    {copiedField === "Airbnb URL" ? (
                                      <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                                      className="text-xs max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
                                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >
                                      {vrboTask.field_value}
                                    </a>
                                  </div>
                                   <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                                    onClick={() => copyToClipboard(vrboTask.field_value!, "VRBO URL")}
                                  >
                                    {copiedField === "VRBO URL" ? (
                                      <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                                      className="text-xs max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
                                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >
                                      {directTask.field_value}
                                    </a>
                                  </div>
                                   <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                                    onClick={() => copyToClipboard(directTask.field_value!, "Direct Booking Website")}
                                  >
                                    {copiedField === "Direct Booking Website" ? (
                                      <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                                      className="text-xs max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
                                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >
                                      {bookingTask.field_value}
                                    </a>
                                  </div>
                                   <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                                    onClick={() => copyToClipboard(bookingTask.field_value!, "Booking.com URL")}
                                  >
                                    {copiedField === "Booking.com URL" ? (
                                      <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                                      className="text-xs max-md:text-base text-primary hover:underline break-words overflow-wrap-anywhere block"
                                      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                    >
                                      {zillowTask.field_value}
                                    </a>
                                  </div>
                                   <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                                    onClick={() => copyToClipboard(zillowTask.field_value!, "Zillow URL")}
                                  >
                                    {copiedField === "Zillow URL" ? (
                                      <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                            className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                            onClick={() => copyToClipboard(`$${propertyInfo.visit_price}`, "Visit Price")}
                          >
                            {copiedField === "Visit Price" ? (
                              <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
                            )}
                          </Button>
                        </div>
                      )}
                      {propertyInfo.management_fee_percentage && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                              <p className="text-xs font-medium text-muted-foreground">Management Fee</p>
                            </div>
                            <p className="text-sm ml-5 font-semibold">{propertyInfo.management_fee_percentage}%</p>
                          </div>
                           <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                            onClick={() => copyToClipboard(`${propertyInfo.management_fee_percentage}%`, "Management Fee")}
                          >
                            {copiedField === "Management Fee" ? (
                              <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                            className="h-7 w-7 max-md:h-11 max-md:w-11 flex-shrink-0"
                            onClick={() => copyToClipboard(propertyInfo.rental_type.replace('_', ' '), "Rental Type")}
                          >
                            {copiedField === "Rental Type" ? (
                              <Check className="h-3.5 w-3.5 max-md:h-5 max-md:w-5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 max-md:h-5 max-md:w-5" />
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
                            className="h-7 w-7 max-md:h-12 max-md:w-12 flex-shrink-0 flex"
                            onClick={() => copyToClipboard(propertyInfo.address, "Address")}
                          >
                            {copiedField === "Address" ? (
                              <Check className="h-3.5 w-3.5 max-md:h-6 max-md:w-6 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 max-md:h-6 max-md:w-6" />
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Mapped Data from Documents - Show completed tasks with values */}
                {(() => {
                  // Show all tasks that have values - don't require completed status
                  const mappedTasks = tasks.filter(t => 
                    t.field_value && 
                    t.field_value.trim() !== '' &&
                    // Exclude listing URLs as they're shown above
                    !t.title.toLowerCase().includes('airbnb') &&
                    !t.title.toLowerCase().includes('vrbo') &&
                    !t.title.toLowerCase().includes('booking.com') &&
                    !t.title.toLowerCase().includes('zillow') &&
                    !t.title.toLowerCase().includes('direct booking')
                  );
                  
                  if (mappedTasks.length === 0) return null;
                  
                  // Group by phase
                  const groupedByPhase: Record<string, typeof mappedTasks> = {};
                  mappedTasks.forEach(task => {
                    const phase = task.phase_title || 'Other';
                    if (!groupedByPhase[phase]) groupedByPhase[phase] = [];
                    groupedByPhase[phase].push(task);
                  });
                  
                  return (
                    <Card className="border-2 border-green-500/30 bg-green-50/30 dark:bg-green-950/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-green-600" />
                            Extracted Data from Documents
                            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              {mappedTasks.length} fields populated
                            </Badge>
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {Object.entries(groupedByPhase).map(([phase, phaseTasks]) => (
                          <div key={phase} className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground border-b border-border/50 pb-1">{phase}</p>
                            <div className="grid gap-2">
                              {phaseTasks.map(task => (
                                <div key={task.id} className={`flex items-start justify-between gap-2 p-2 rounded-md ${searchQuery && (task.title.toLowerCase().includes(searchQuery.toLowerCase()) || task.field_value?.toLowerCase().includes(searchQuery.toLowerCase())) ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : 'bg-background/50'}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-muted-foreground">{highlightText(task.title, searchQuery)}</p>
                                    <p className="text-sm font-medium break-words">{highlightText(task.field_value || '', searchQuery)}</p>
                                    {task.notes && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">{highlightText(task.notes, searchQuery)}</p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 flex-shrink-0"
                                    onClick={() => copyToClipboard(task.field_value!, task.title)}
                                  >
                                    {copiedField === task.title ? (
                                      <Check className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Financial Performance Data - from owner onboarding */}
                {financialData && (
                  <Card className="border-2 border-green-500/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        Owner-Submitted Financial Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        {financialData.last_year_revenue && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Last Year Revenue</p>
                            <p className="text-lg font-bold text-green-600">${financialData.last_year_revenue.toLocaleString()}</p>
                          </div>
                        )}
                        {financialData.average_daily_rate && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Average Daily Rate</p>
                            <p className="text-lg font-bold">${financialData.average_daily_rate}</p>
                          </div>
                        )}
                        {financialData.occupancy_rate && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Occupancy Rate</p>
                            <p className="text-lg font-bold">{financialData.occupancy_rate}%</p>
                          </div>
                        )}
                        {financialData.average_monthly_revenue && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Avg Monthly Revenue</p>
                            <p className="text-lg font-bold">${financialData.average_monthly_revenue.toLocaleString()}</p>
                          </div>
                        )}
                        {financialData.average_booking_window && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Avg Booking Window</p>
                            <p className="text-lg font-bold">{financialData.average_booking_window} days</p>
                          </div>
                        )}
                        {financialData.peak_season && (
                          <div className="bg-muted/50 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground">Peak Season</p>
                            <p className="text-lg font-bold">{financialData.peak_season}</p>
                            {financialData.peak_season_adr && (
                              <p className="text-xs text-muted-foreground">ADR: ${financialData.peak_season_adr}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Goals & Insights */}
                      {(financialData.pricing_revenue_goals || financialData.competitor_insights) && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          {financialData.pricing_revenue_goals && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Pricing & Revenue Goals</p>
                              <p className="text-sm">{financialData.pricing_revenue_goals}</p>
                            </div>
                          )}
                          {financialData.competitor_insights && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">Competitor Insights</p>
                              <p className="text-sm">{financialData.competitor_insights}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Document Links */}
                      {(financialData.revenue_statement_url || financialData.expense_report_url || 
                        financialData.airbnb_revenue_export_url || financialData.vrbo_revenue_export_url || 
                        financialData.ownerrez_revenue_export_url) && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Uploaded Documents
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {financialData.revenue_statement_url && (
                              <a 
                                href={financialData.revenue_statement_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Revenue Statement
                              </a>
                            )}
                            {financialData.expense_report_url && (
                              <a 
                                href={financialData.expense_report_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Expense Report
                              </a>
                            )}
                            {financialData.airbnb_revenue_export_url && (
                              <a 
                                href={financialData.airbnb_revenue_export_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Airbnb Revenue Export
                              </a>
                            )}
                            {financialData.vrbo_revenue_export_url && (
                              <a 
                                href={financialData.vrbo_revenue_export_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                                VRBO Revenue Export
                              </a>
                            )}
                            {financialData.ownerrez_revenue_export_url && (
                              <a 
                                href={financialData.ownerrez_revenue_export_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20"
                              >
                                <ExternalLink className="h-3 w-3" />
                                OwnerRez Revenue Export
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Property Information from Owner Intel */}
                {separatedOwnerActions.propertyInfoActions.length > 0 && (
                  <Card className="border-2 border-emerald-500/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Info className="h-4 w-4 text-emerald-600" />
                        Property Information ({separatedOwnerActions.propertyInfoActions.length} items)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        // Group property info by category
                        const categoryMap: Record<string, any[]> = {};
                        separatedOwnerActions.propertyInfoActions.forEach(action => {
                          const cat = action.category || 'General';
                          if (!categoryMap[cat]) categoryMap[cat] = [];
                          categoryMap[cat].push(action);
                        });
                        
                        return Object.entries(categoryMap).map(([category, items]) => {
                          const IconComponent = filteredOwnerIntel.categoryIcons[category] || Info;
                          const isExpanded = expandedCategories[`info_${category}`] !== false;
                          
                          return (
                            <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(`info_${category}`)}>
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center justify-between cursor-pointer p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="h-4 w-4 text-emerald-600" />
                                    <span className="font-medium text-sm">{category}</span>
                                    <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">{items.length}</Badge>
                                  </div>
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-2 space-y-2">
                                {items.map((item: any) => (
                                  <div key={item.id} className="ml-6 p-2 border-l-2 border-emerald-300 space-y-1">
                                    <p className="font-medium text-sm">{item.title}</p>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                                    {item.content?.items && Array.isArray(item.content.items) && (
                                      <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                        {item.content.items.map((bullet: string, idx: number) => (
                                          <li key={idx} className="flex items-start gap-1">
                                            <span className="text-emerald-600">•</span>
                                            <span>{bullet}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 text-xs"
                                      onClick={() => copyToClipboard(item.description || item.title, item.title)}
                                    >
                                      {copiedField === item.title ? (
                                        <><Check className="h-3 w-3 mr-1 text-green-600" /> Copied</>
                                      ) : (
                                        <><Copy className="h-3 w-3 mr-1" /> Copy</>
                                      )}
                                    </Button>
                                  </div>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          );
                        });
                      })()}
                    </CardContent>
                  </Card>
                )}

                {/* Admin Tasks removed - now shown in Initial Setup Tasks modal on Properties page */}

                {/* Setup Notes - Pending Actions */}
                {separatedOwnerActions.setupNotes.length > 0 && (
                  <Card className="border-2 border-yellow-500/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        Setup Notes ({separatedOwnerActions.setupNotes.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {separatedOwnerActions.setupNotes.map((note: any) => (
                        <div key={note.id} className="p-3 border rounded-lg bg-yellow-50/50 dark:bg-yellow-950/20 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{note.title}</p>
                              {note.description && (
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{note.description}</p>
                              )}
                              {note.content?.items && Array.isArray(note.content.items) && (
                                <ul className="text-xs text-muted-foreground space-y-0.5 mt-2">
                                  {note.content.items.map((bullet: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-1">
                                      <span className="text-yellow-600">•</span>
                                      <span>{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => copyToClipboard(note.description || note.title, note.title)}
                          >
                            {copiedField === note.title ? (
                              <><Check className="h-3 w-3 mr-1 text-green-600" /> Copied</>
                            ) : (
                              <><Copy className="h-3 w-3 mr-1" /> Copy</>
                            )}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Uploaded Documents from Owner Conversations */}
                {ownerDocuments.length > 0 && (
                  <Card className="border-2 border-blue-500/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-600" />
                        Uploaded Documents ({ownerDocuments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {ownerDocuments.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{doc.file_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  From: {doc.owner_conversations?.title || 'Unknown'} • {new Date(doc.created_at).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-shrink-0"
                              onClick={async () => {
                                try {
                                  const { data } = await supabase.storage
                                    .from('onboarding-documents')
                                    .createSignedUrl(doc.file_path, 3600);
                                  if (data?.signedUrl) {
                                    window.open(data.signedUrl, '_blank');
                                  }
                                } catch (error) {
                                  toast.error('Failed to open document');
                                }
                              }}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
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
                              <div key={idx} className={`flex items-center justify-between gap-2 py-1 px-2 rounded ${(labelMatch || valueMatch) ? 'bg-yellow-100 dark:bg-yellow-900/30 ring-2 ring-yellow-400' : ''}`}>
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
                                   <div className="text-sm max-md:text-base ml-5 break-words">
                                    {isUrl(item.value) ? (
                                      <a 
                                        href={item.value.startsWith('http') ? item.value : `https://${item.value}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline inline-flex items-center gap-1 break-words overflow-wrap-anywhere"
                                        style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                      >
                                        {valueMatch ? (
                                          <span className="bg-yellow-200 dark:bg-yellow-900">{item.value}</span>
                                        ) : (
                                          item.value
                                        )}
                                        <LinkIcon className="h-3 w-3 max-md:h-4 max-md:w-4 flex-shrink-0" />
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
                                  className="h-7 w-7 max-md:h-12 max-md:w-12 flex-shrink-0 flex"
                                  onClick={() => copyToClipboard(item.value, item.label)}
                                >
                                  {copiedField === item.label ? (
                                    <Check className="h-3.5 w-3.5 max-md:h-6 max-md:w-6 text-green-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5 max-md:h-6 max-md:w-6" />
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

                {/* Inspection Data Section */}
                {propertyId && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-primary" />
                        Inspection Data
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InspectionDataSection propertyId={propertyId} />
                    </CardContent>
                  </Card>
                )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              {/* Maintenance Book Tab */}
              <TabsContent value="maintenance" className="flex-1 min-h-0 mt-4">
                {propertyId ? (
                  <MaintenanceBookTab propertyId={propertyId} />
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    No property selected
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="documents" className="flex-1 min-h-0 mt-4">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-4">
                    {/* Owner-Provided Documents */}
                    <Card className="border-2 border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-amber-600" />
                          Owner-Provided Documents
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                            {propertyDocuments.length} {propertyDocuments.length === 1 ? 'file' : 'files'}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {propertyDocuments.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No documents uploaded yet
                          </p>
                        ) : (
                          propertyDocuments.map((doc) => (
                            <div 
                              key={doc.id} 
                              className="flex items-start justify-between gap-3 bg-background/50 p-4 rounded-lg border border-amber-200/50 hover:border-amber-300 transition-colors cursor-pointer"
                              onClick={() => setViewerDoc({ path: doc.file_path, name: doc.file_name, type: doc.file_type })}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {doc.file_type?.includes('pdf') || doc.file_name?.toLowerCase().endsWith('.pdf') ? (
                                    <FileText className="h-5 w-5 text-red-500 flex-shrink-0" />
                                  ) : doc.file_type?.includes('sheet') || doc.file_type?.includes('excel') || doc.file_name?.toLowerCase().includes('.xlsx') ? (
                                    <FileSpreadsheet className="h-5 w-5 text-green-600 flex-shrink-0" />
                                  ) : (
                                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                  )}
                                  <p className="font-medium">{doc.file_name}</p>
                                </div>
                                {doc.description && (
                                  <p className="text-sm text-muted-foreground mt-2 ml-7">{doc.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 ml-7">
                                  <Badge variant="outline" className="text-xs bg-amber-50 border-amber-200 text-amber-700">
                                    Owner Provided
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Added {new Date(doc.created_at).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => setViewerDoc({ path: doc.file_path, name: doc.file_name, type: doc.file_type })}
                                >
                                  <Eye className="h-4 w-4" />
                                  View
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(doc.file_path, '_blank')}
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a href={doc.file_path} download={doc.file_name} title="Download document">
                                    <Download className="h-4 w-4" />
                                  </a>
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    {/* Conversation Documents */}
                    {ownerDocuments.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Conversation Attachments
                            <Badge variant="secondary">
                              {ownerDocuments.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {ownerDocuments.map((doc) => (
                            <div 
                              key={doc.id} 
                              className="flex items-start justify-between gap-3 bg-muted/50 p-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
                              onClick={() => setViewerDoc({ path: doc.file_path, name: doc.file_name, type: doc.file_type })}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                  <p className="text-sm font-medium">{doc.file_name}</p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 ml-6">
                                  From: {doc.owner_conversations?.title || 'Conversation'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setViewerDoc({ path: doc.file_path, name: doc.file_name, type: doc.file_type })}
                                  title="View document"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => window.open(doc.file_path, '_blank')}
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Document Viewer Modal */}
        <DocumentViewer
          open={!!viewerDoc}
          onOpenChange={(open) => !open && setViewerDoc(null)}
          filePath={viewerDoc?.path || ''}
          fileName={viewerDoc?.name || ''}
          fileType={viewerDoc?.type}
        />
      </DialogContent>
    </Dialog>
  );
}
