import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const bugSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(2000, "Description must be less than 2000 characters"),
  loom_video_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

type BugFormData = z.infer<typeof bugSchema>;

interface SubmitBugDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId?: string;
  projectId?: string;
  taskId?: string;
}

export function SubmitBugDialog({ open, onOpenChange, propertyId, projectId, taskId }: SubmitBugDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BugFormData>({
    resolver: zodResolver(bugSchema),
    defaultValues: {
      title: "",
      description: "",
      loom_video_url: "",
      priority: "medium",
    },
  });

  const onSubmit = async (data: BugFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to submit a bug report");
        return;
      }

      const { data: bugReport, error: insertError } = await supabase
        .from("bug_reports")
        .insert({
          title: data.title,
          description: data.description,
          loom_video_url: data.loom_video_url || null,
          priority: data.priority,
          submitted_by: user.id,
          property_id: propertyId || null,
          project_id: projectId || null,
          task_id: taskId || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send email notification
      const { error: emailError } = await supabase.functions.invoke("send-bug-notification", {
        body: {
          type: "new_bug",
          bugId: bugReport.id,
        },
      });

      onOpenChange(false);
      form.reset();
      toast.success("Bug report submitted successfully!");
      
      if (emailError) {
        console.error("Error sending email notification:", emailError);
      }
    } catch (error: any) {
      console.error("Error submitting bug report:", error);
      toast.error(error.message || "Failed to submit bug report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Submit a Bug or Improvement Request</DialogTitle>
          <DialogDescription>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Purpose:</strong> This form is for reporting technical errors, tools that don't work as intended, or suggesting improvements to the platform.
              </p>
              <p className="font-semibold">
                Please include improvement tips and suggestions in your description to help us enhance the platform.
              </p>
              <p className="text-muted-foreground">
                Include as much detail as possible: what happened, what you expected to happen, steps to reproduce the issue, and any ideas for improvement.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bug Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Brief description of the bug" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the bug in detail:&#10;- What happened?&#10;- What did you expect to happen?&#10;- Steps to reproduce?&#10;&#10;Improvement suggestions (please include):&#10;- How could this be better?&#10;- What would improve your workflow?"
                      className="min-h-[160px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="loom_video_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Loom Video URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://www.loom.com/share/..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Bug Report
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
