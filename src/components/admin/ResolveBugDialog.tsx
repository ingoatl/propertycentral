import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const resolveSchema = z.object({
  resolution_notes: z.string().min(10, "Resolution notes must be at least 10 characters"),
});

type ResolveFormData = z.infer<typeof resolveSchema>;

interface ResolveBugDialogProps {
  bug: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}

export function ResolveBugDialog({ bug, open, onOpenChange, onResolved }: ResolveBugDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResolveFormData>({
    resolver: zodResolver(resolveSchema),
    defaultValues: {
      resolution_notes: "",
    },
  });

  const onSubmit = async (data: ResolveFormData) => {
    if (!bug) return;
    
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const { error: updateError } = await supabase
        .from("bug_reports")
        .update({
          status: "resolved",
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: data.resolution_notes,
        })
        .eq("id", bug.id);

      if (updateError) throw updateError;

      // Send email notification
      const { error: emailError } = await supabase.functions.invoke("send-bug-notification", {
        body: {
          type: "bug_resolved",
          bugId: bug.id,
        },
      });

      if (emailError) {
        console.error("Error sending email notification:", emailError);
      }

      toast.success("Bug marked as resolved!");
      form.reset();
      onOpenChange(false);
      onResolved();
    } catch (error: any) {
      console.error("Error resolving bug:", error);
      toast.error(error.message || "Failed to resolve bug");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Resolve Bug Report</DialogTitle>
          <DialogDescription>
            Document how this bug was fixed. The user will be notified via email.
          </DialogDescription>
        </DialogHeader>
        {bug && (
          <div className="mb-4 p-4 bg-muted rounded-md">
            <h4 className="font-semibold mb-2">{bug.title}</h4>
            <p className="text-sm text-muted-foreground">{bug.description}</p>
          </div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="resolution_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe how the bug was fixed and any relevant details..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
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
                Mark as Resolved
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
