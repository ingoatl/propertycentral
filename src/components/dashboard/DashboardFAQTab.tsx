import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { FAQ } from "@/types/onboarding";
import { toast } from "sonner";
import { Search, MessageCircleQuestion, Building2, Plus } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

const FAQ_CATEGORIES = [
  'All Categories',
  'Access & Entry',
  'Utilities & Amenities',
  'House Rules',
  'Maintenance',
  'Guest Experience',
  'Emergency',
  'Other'
];

export function DashboardFAQTab() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newFAQ, setNewFAQ] = useState({
    question: "",
    answer: "",
    category: "",
    property_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all FAQs
      const { data: faqsData, error: faqsError } = await supabase
        .from('frequently_asked_questions')
        .select('*')
        .order('created_at', { ascending: false });

      if (faqsError) throw faqsError;
      setFaqs(faqsData || []);

      // Load properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name')
        .order('name', { ascending: true });

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);
    } catch (error: any) {
      console.error('Error loading FAQs:', error);
      toast.error('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFAQ = async () => {
    try {
      if (!newFAQ.question.trim() || !newFAQ.answer.trim() || !newFAQ.property_id) {
        toast.error("Please fill in all required fields");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to add FAQs");
        return;
      }

      const { error } = await supabase
        .from('frequently_asked_questions')
        .insert({
          question: newFAQ.question.trim(),
          answer: newFAQ.answer.trim(),
          category: newFAQ.category || 'Other',
          property_id: newFAQ.property_id,
          answered_by: user.id,
        });

      if (error) throw error;

      toast.success("FAQ added successfully!");
      setShowAddDialog(false);
      setNewFAQ({ question: "", answer: "", category: "", property_id: "" });
      loadData();
    } catch (error: any) {
      console.error('Error adding FAQ:', error);
      toast.error("Failed to add FAQ");
    }
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesSearch = searchQuery === "" || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "All Categories" || faq.category === selectedCategory;
    const matchesProperty = selectedProperty === "all" || faq.property_id === selectedProperty;
    
    return matchesSearch && matchesCategory && matchesProperty;
  });

  // Group FAQs by property
  const faqsByProperty = filteredFAQs.reduce((acc, faq) => {
    const propertyId = faq.property_id;
    if (!acc[propertyId]) {
      acc[propertyId] = [];
    }
    acc[propertyId].push(faq);
    return acc;
  }, {} as Record<string, FAQ[]>);

  // Group FAQs by category within each property
  const groupedFAQs = Object.entries(faqsByProperty).map(([propertyId, propertyFaqs]) => {
    const property = properties.find(p => p.id === propertyId);
    const faqsByCategory = propertyFaqs.reduce((acc, faq) => {
      const category = faq.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(faq);
      return acc;
    }, {} as Record<string, FAQ[]>);

    return {
      propertyId,
      propertyName: property?.name || 'Unknown Property',
      faqsByCategory
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading FAQs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Property FAQs</h2>
          <p className="text-muted-foreground">
            Frequently asked questions across all properties
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions and answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FAQ_CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Property</label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQs Grouped by Property and Category */}
      {groupedFAQs.length > 0 ? (
        <div className="space-y-6">
          {groupedFAQs.map(({ propertyId, propertyName, faqsByCategory }) => (
            <Card key={propertyId}>
              <CardHeader className="bg-gradient-subtle">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {propertyName}
                </CardTitle>
                <CardDescription>
                  {Object.values(faqsByCategory).flat().length} FAQ{Object.values(faqsByCategory).flat().length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <Accordion type="multiple" className="w-full">
                  {Object.entries(faqsByCategory).map(([category, categoryFAQs]) => (
                    <div key={category} className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground mt-4 mb-2 flex items-center gap-2">
                        <MessageCircleQuestion className="h-4 w-4" />
                        {category}
                      </h3>
                      {categoryFAQs.map((faq) => {
                        const isHighlighted = searchQuery && (
                          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
                        );
                        return (
                          <AccordionItem key={faq.id} value={faq.id} className={isHighlighted ? 'bg-primary/5 rounded-lg' : ''}>
                            <AccordionTrigger className="text-left hover:no-underline px-4">
                              <span className="font-medium">{faq.question}</span>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 pb-4">
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                {faq.answer}
                              </p>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </div>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircleQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {searchQuery || selectedCategory !== "All Categories" || selectedProperty !== "all"
                ? "No FAQs match your search criteria"
                : "No FAQs have been added yet"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Add FAQ Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New FAQ</DialogTitle>
            <DialogDescription>
              Add a frequently asked question for a property
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="property">Property *</Label>
              <Select
                value={newFAQ.property_id}
                onValueChange={(value) => setNewFAQ({ ...newFAQ, property_id: value })}
              >
                <SelectTrigger id="property">
                  <SelectValue placeholder="Select a property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={newFAQ.category}
                onValueChange={(value) => setNewFAQ({ ...newFAQ, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {FAQ_CATEGORIES.filter(cat => cat !== 'All Categories').map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                placeholder="What is the WiFi password?"
                value={newFAQ.question}
                onChange={(e) => setNewFAQ({ ...newFAQ, question: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="answer">Answer *</Label>
              <Textarea
                id="answer"
                placeholder="The WiFi network is 'PropertyName-Guest' and the password is..."
                rows={6}
                value={newFAQ.answer}
                onChange={(e) => setNewFAQ({ ...newFAQ, answer: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFAQ}>
              Add FAQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
