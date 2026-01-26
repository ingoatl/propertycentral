import { useState } from 'react';
import { ListTodo, Forward, Wrench, Calendar, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/ProtectedRoute';
import type { TeamMessage } from '@/hooks/useTeamHub';

interface QuickActionsProps {
  message: TeamMessage;
  onActionComplete?: () => void;
}

type ActionType = 'task' | 'work-order' | 'schedule' | null;

export function QuickActions({ message, onActionComplete }: QuickActionsProps) {
  const { user } = useAuth();
  const [actionType, setActionType] = useState<ActionType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
  });

  const handleCreateTask = async () => {
    if (!user || !formData.title.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Create a task in onboarding_tasks table (general purpose tasks)
      const { error } = await supabase
        .from('onboarding_tasks')
        .insert({
          title: formData.title,
          description: formData.description || `Created from Team Hub message: "${message.content.slice(0, 100)}..."`,
          created_by: user.id,
          status: 'pending',
          property_id: message.property_id,
        });

      if (error) throw error;

      toast.success('Task created successfully');
      setActionType(null);
      setFormData({ title: '', description: '', dueDate: '' });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateWorkOrder = async () => {
    if (!user || !formData.title.trim()) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .insert({
          title: formData.title,
          description: formData.description || `Created from Team Hub message: "${message.content.slice(0, 100)}..."`,
          created_by: user.id,
          status: 'pending',
          urgency: 'medium',
          property_id: message.property_id,
          source: 'team_hub',
        });

      if (error) throw error;

      toast.success('Work order created');
      setActionType(null);
      setFormData({ title: '', description: '', dueDate: '' });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to create work order:', error);
      toast.error('Failed to create work order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    if (!user || !formData.dueDate) {
      toast.error('Please select a date');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Create a follow-up task
      const { error } = await supabase
        .from('onboarding_tasks')
        .insert({
          title: formData.title || `Follow-up: ${message.content.slice(0, 50)}...`,
          description: formData.description || `Follow up on Team Hub message from ${message.sender?.first_name || 'team member'}`,
          created_by: user.id,
          status: 'pending',
          property_id: message.property_id,
        });

      if (error) throw error;

      toast.success('Follow-up scheduled');
      setActionType(null);
      setFormData({ title: '', description: '', dueDate: '' });
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to schedule follow-up:', error);
      toast.error('Failed to schedule follow-up');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openAction = (type: ActionType) => {
    setFormData({
      title: message.content.slice(0, 100),
      description: '',
      dueDate: '',
    });
    setActionType(type);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => openAction('task')}>
            <ListTodo className="h-4 w-4 mr-2" />
            Create Task
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openAction('work-order')}>
            <Wrench className="h-4 w-4 mr-2" />
            Create Work Order
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openAction('schedule')}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Follow-up
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Forward className="h-4 w-4 mr-2" />
            Forward to Owner
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Task Dialog */}
      <Dialog open={actionType === 'task'} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Task from Message</DialogTitle>
            <DialogDescription>
              Convert this message into an actionable task.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (optional)</Label>
              <Textarea
                id="task-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Add more details..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Work Order Dialog */}
      <Dialog open={actionType === 'work-order'} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
            <DialogDescription>
              Create a maintenance work order from this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="wo-title">Work Order Title</Label>
              <Input
                id="wo-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter work order title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-description">Description</Label>
              <Textarea
                id="wo-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the maintenance issue..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkOrder} disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <Dialog open={actionType === 'schedule'} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Follow-up</DialogTitle>
            <DialogDescription>
              Set a reminder to follow up on this message.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="followup-title">Reminder Title</Label>
              <Input
                id="followup-title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="What should you follow up on?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="followup-date">Follow-up Date</Label>
              <Input
                id="followup-date"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionType(null)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleFollowUp} disabled={isSubmitting || !formData.dueDate}>
              {isSubmitting ? 'Scheduling...' : 'Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
