import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Hash, Plus, Loader2 } from 'lucide-react';

interface ChannelTemplate {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  channel_type: string;
  icon_emoji: string | null;
  is_system: boolean;
  sort_order: number;
}

export function ChannelTemplates() {
  const queryClient = useQueryClient();
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['channel-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_channel_templates')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as ChannelTemplate[];
    },
  });

  const { data: existingChannels } = useQuery({
    queryKey: ['team-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_channels')
        .select('name');
      if (error) throw error;
      return data.map(c => c.name);
    },
  });

  const createChannelsMutation = useMutation({
    mutationFn: async (templateIds: string[]) => {
      const templatesToCreate = templates?.filter(t => templateIds.includes(t.id)) || [];
      
      for (const template of templatesToCreate) {
        // Skip if channel already exists
        if (existingChannels?.includes(template.name)) continue;

        const { error } = await supabase
          .from('team_channels')
          .insert({
            name: template.name,
            display_name: template.display_name,
            description: template.description,
            channel_type: template.channel_type as 'public' | 'private',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-channels'] });
      toast.success('Channels created successfully');
      setSelectedTemplates([]);
    },
    onError: (error) => {
      console.error('Failed to create channels:', error);
      toast.error('Failed to create channels');
    },
  });

  const toggleTemplate = (templateId: string) => {
    setSelectedTemplates(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const handleCreateChannels = () => {
    if (selectedTemplates.length === 0) {
      toast.error('Please select at least one channel template');
      return;
    }
    createChannelsMutation.mutate(selectedTemplates);
  };

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const availableTemplates = templates?.filter(
    t => !existingChannels?.includes(t.name)
  ) || [];

  if (availableTemplates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Templates</CardTitle>
          <CardDescription>
            All recommended channels have been created.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Hash className="h-4 w-4" />
          Quick Setup: Recommended Channels
        </CardTitle>
        <CardDescription>
          Create pre-configured channels for your property management team.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {availableTemplates.map((template) => (
            <label
              key={template.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <Checkbox
                checked={selectedTemplates.includes(template.id)}
                onCheckedChange={() => toggleTemplate(template.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{template.icon_emoji}</span>
                  <span className="font-medium">#{template.name}</span>
                  {template.is_system && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {template.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        <Button
          onClick={handleCreateChannels}
          disabled={selectedTemplates.length === 0 || createChannelsMutation.isPending}
          className="w-full"
        >
          {createChannelsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Create {selectedTemplates.length} Channel{selectedTemplates.length !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
