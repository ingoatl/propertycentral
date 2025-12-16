import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, DollarSign, Clock, Wrench, Eye, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const availabilityOptions = [
  { id: "weekdays", label: "Weekdays" },
  { id: "weekends", label: "Weekends" },
  { id: "evenings", label: "Evenings" },
  { id: "flexible", label: "Flexible" },
];

export default function JobApplication() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    availability: [] as string[],
    hasTechnicalSkills: false,
    detailOrientedExample: "",
  });

  const toggleAvailability = (id: string) => {
    setFormData(prev => ({
      ...prev,
      availability: prev.availability.includes(id)
        ? prev.availability.filter(a => a !== id)
        : [...prev.availability, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName || !formData.email || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("job_applications")
        .insert({
          full_name: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          availability: formData.availability,
          has_technical_skills: formData.hasTechnicalSkills,
          detail_oriented_example: formData.detailOrientedExample || null,
        });

      if (error) throw error;
      setIsSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting application:", error);
      toast.error("Failed to submit application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* iOS Header */}
        <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center justify-center h-14 px-4">
            <h1 className="text-base font-semibold">Application Submitted</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Thank You!</h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Your application has been received. We'll review it and contact you within 48 hours.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setIsSubmitted(false);
              setFormData({
                fullName: "",
                email: "",
                phone: "",
                availability: [],
                hasTechnicalSkills: false,
                detailOrientedExample: "",
              });
            }}
          >
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* iOS Header */}
      <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-center h-14 px-4">
          <h1 className="text-base font-semibold">Apply Now</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6 border-b border-border/50">
          <div className="max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-2">Property Inspector & Maintenance Tech</h2>
            <p className="text-sm text-muted-foreground mb-4">
              We're looking for someone detail-oriented who takes pride in a home running perfectly.
            </p>
            
            {/* Job highlights */}
            <div className="flex gap-3">
              <div className="flex items-center gap-2 bg-background/80 rounded-full px-3 py-1.5">
                <DollarSign className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium">$25-30/hr</span>
              </div>
              <div className="flex items-center gap-2 bg-background/80 rounded-full px-3 py-1.5">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">5-10 hrs/week</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 max-w-md mx-auto space-y-6">
          {/* Contact Info Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h3 className="text-sm font-semibold">Contact Information</h3>
            </div>
            <div className="divide-y divide-border">
              <div className="px-4 py-3">
                <Label htmlFor="fullName" className="text-xs text-muted-foreground mb-1 block">
                  Full Name *
                </Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                  placeholder="John Smith"
                  className="border-0 p-0 h-auto text-base focus-visible:ring-0 bg-transparent"
                  required
                />
              </div>
              <div className="px-4 py-3">
                <Label htmlFor="email" className="text-xs text-muted-foreground mb-1 block">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="john@example.com"
                  className="border-0 p-0 h-auto text-base focus-visible:ring-0 bg-transparent"
                  required
                />
              </div>
              <div className="px-4 py-3">
                <Label htmlFor="phone" className="text-xs text-muted-foreground mb-1 block">
                  Phone *
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="border-0 p-0 h-auto text-base focus-visible:ring-0 bg-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {/* Availability Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h3 className="text-sm font-semibold">Availability</h3>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap gap-2">
                {availabilityOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleAvailability(option.id)}
                    className={cn(
                      "px-4 py-2 rounded-full text-sm font-medium transition-all",
                      formData.availability.includes(option.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Skills Section */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/30 border-b border-border">
              <h3 className="text-sm font-semibold">Skills & Experience</h3>
            </div>
            <div className="divide-y divide-border">
              {/* Technical Skills Toggle */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Technical Skills</p>
                    <p className="text-xs text-muted-foreground">Smart locks, minor repairs, etc.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, hasTechnicalSkills: !prev.hasTechnicalSkills }))}
                  className={cn(
                    "w-12 h-7 rounded-full transition-colors relative",
                    formData.hasTechnicalSkills ? "bg-green-500" : "bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform",
                      formData.hasTechnicalSkills ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>

              {/* Detail Oriented Example */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Eye className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">What makes you detail-oriented?</p>
                    <p className="text-xs text-muted-foreground">Give us an example</p>
                  </div>
                </div>
                <Textarea
                  value={formData.detailOrientedExample}
                  onChange={(e) => setFormData(prev => ({ ...prev, detailOrientedExample: e.target.value }))}
                  placeholder="I once noticed a slow WiFi connection and traced it to..."
                  className="min-h-[100px] text-sm resize-none"
                  rows={4}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pb-8">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Application"}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-3">
              We'll review your application and get back to you within 48 hours.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
