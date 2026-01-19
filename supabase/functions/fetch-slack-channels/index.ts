import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_archived: boolean;
  is_private: boolean;
  is_member: boolean;
  topic?: { value: string };
  purpose?: { value: string };
  num_members?: number;
}

interface SlackConversationsListResponse {
  ok: boolean;
  channels?: SlackChannel[];
  response_metadata?: {
    next_cursor?: string;
  };
  error?: string;
}

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');

// Fetch all public channels from Slack workspace
async function fetchSlackChannels(): Promise<SlackChannel[]> {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN is not configured');
    throw new Error('SLACK_BOT_TOKEN not configured');
  }

  const allChannels: SlackChannel[] = [];
  let cursor: string | undefined;
  let attempts = 0;
  const maxAttempts = 10; // Safety limit

  do {
    attempts++;
    console.log(`[Slack] Fetching channels, attempt ${attempts}, cursor: ${cursor || 'none'}`);

    const params = new URLSearchParams({
      types: 'public_channel', // Only public channels for now
      exclude_archived: 'true',
      limit: '200',
    });
    
    if (cursor) {
      params.append('cursor', cursor);
    }

    const response = await fetch(`https://slack.com/api/conversations.list?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    const result: SlackConversationsListResponse = await response.json();
    console.log(`[Slack] Response ok: ${result.ok}, channels: ${result.channels?.length || 0}`);

    if (!result.ok) {
      console.error('[Slack] API error:', result.error);
      
      if (result.error === 'missing_scope') {
        throw new Error('Bot needs channels:read scope. Please add this scope in Slack app settings.');
      }
      
      throw new Error(result.error || 'Failed to fetch channels');
    }

    if (result.channels) {
      allChannels.push(...result.channels);
    }

    cursor = result.response_metadata?.next_cursor;
    
  } while (cursor && attempts < maxAttempts);

  console.log(`[Slack] Total channels fetched: ${allChannels.length}`);
  
  return allChannels;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log('[fetch-slack-channels] Fetching channels from Slack API...');

    // Fetch channels directly from Slack API
    const slackChannels = await fetchSlackChannels();

    // Transform to a cleaner format
    const channels = slackChannels.map(ch => ({
      id: ch.id,
      name: ch.name,
      display_name: ch.name,
      description: ch.purpose?.value || ch.topic?.value || null,
      is_private: ch.is_private,
      is_member: ch.is_member,
      num_members: ch.num_members || 0,
    }));

    // Sort by name
    channels.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[fetch-slack-channels] Returning ${channels.length} channels`);

    return new Response(JSON.stringify({ 
      success: true, 
      channels,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[fetch-slack-channels] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
