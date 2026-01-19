import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackRequest {
  channel?: string;
  channelId?: string; // Direct Slack channel ID for reliable posting
  message: string;
  template?: string;
  context?: {
    propertyId?: string;
    leadId?: string;
    ownerId?: string;
  };
  mentionUsers?: string[];
  directMessage?: boolean;
  recipientUserId?: string;
}

// Team member Slack IDs - hardcoded for reliable lookups
const TEAM_MEMBERS: Record<string, { slackId: string }> = {
  'alex': { slackId: 'U08B9QPLL5V' },
  'anja': { slackId: 'U08CD5FCZNC' },
  'catherine': { slackId: 'U08C09NHNDT' },
  'chris': { slackId: 'U09KEFS65BJ' },
  'ingo': { slackId: 'U08BPU3PQ9H' },
};

// Legacy channel IDs - now we prefer channelId passed from frontend
// These are kept as fallback only
const LEGACY_CHANNEL_IDS: Record<string, string> = {
  'wins': 'C0A967MUW8K',
  'team-wins': 'C0A967MUW8K',
};

// Cache for Slack user IDs (email -> slackId)
const slackUserCache: Record<string, string> = {};

// Get Slack user ID for a team member
function getSlackUserIdForTeamMember(memberKey: string): string | null {
  const member = TEAM_MEMBERS[memberKey.toLowerCase()];
  if (!member) {
    console.log(`[Slack] Unknown team member: ${memberKey}`);
    return null;
  }
  console.log(`[Slack] Using ID for ${memberKey}: ${member.slackId}`);
  return member.slackId;
}

// Get channel ID - prefers passed channelId, falls back to legacy mapping, then name
function getChannelId(channelName: string, channelId?: string): string {
  // If we have a direct channel ID from the frontend, use it
  if (channelId && channelId.startsWith('C')) {
    console.log(`[Slack] Using provided channel ID: ${channelId}`);
    return channelId;
  }
  
  // Try legacy mapping
  const normalizedName = channelName.replace('#', '').toLowerCase();
  const legacyId = LEGACY_CHANNEL_IDS[normalizedName];
  if (legacyId) {
    console.log(`[Slack] Using legacy channel ID for ${normalizedName}: ${legacyId}`);
    return legacyId;
  }
  
  // Fall back to channel name (Slack API can handle names for public channels)
  console.log(`[Slack] Using channel name: ${normalizedName}`);
  return normalizedName;
}

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');

// Send message directly to Slack using the Web API
async function sendSlackMessage(channel: string, text: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN is not configured');
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  console.log(`[Slack] Sending message to channel: ${channel}`);
  console.log(`[Slack] Message preview: ${text.substring(0, 100)}...`);

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channel,
        text: text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });

    console.log(`[Slack] HTTP status: ${response.status}`);
    
    const result = await response.json();
    console.log('[Slack] API response:', JSON.stringify(result).substring(0, 500));

    if (!result.ok) {
      console.error('[Slack] API error:', result.error, result.response_metadata || '');
      return { ok: false, error: result.error || 'Unknown Slack error' };
    }

    console.log(`[Slack] Message sent successfully, ts: ${result.ts}`);
    return { ok: true, ts: result.ts };
  } catch (error) {
    console.error('[Slack] Fetch error:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Send a direct message to a user using conversations.open first
// This requires im:write scope to open DM channels
async function sendSlackDM(userId: string, text: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN is not configured');
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  console.log(`[Slack] Sending DM to user: ${userId}`);
  console.log(`[Slack] DM message preview: ${text.substring(0, 100)}...`);

  try {
    // Step 1: Open a DM channel with the user using conversations.open
    // This requires im:write scope
    console.log('[Slack] Opening DM conversation with conversations.open...');
    const openResponse = await fetch('https://slack.com/api/conversations.open', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        users: userId, // Single user ID
      }),
    });

    const openResult = await openResponse.json();
    console.log('[Slack] conversations.open response:', JSON.stringify(openResult).substring(0, 500));

    if (!openResult.ok) {
      console.error('[Slack] conversations.open error:', openResult.error);
      // Provide helpful error message for scope issues
      if (openResult.error === 'missing_scope') {
        return { ok: false, error: 'Bot needs im:write scope. Please add this scope in Slack app settings.' };
      }
      return { ok: false, error: openResult.error || 'Failed to open DM channel' };
    }

    const dmChannelId = openResult.channel?.id;
    if (!dmChannelId) {
      console.error('[Slack] No channel ID returned from conversations.open');
      return { ok: false, error: 'No DM channel ID returned' };
    }

    console.log(`[Slack] DM channel opened: ${dmChannelId}`);

    // Step 2: Send message to the DM channel
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: dmChannelId, // Use the DM channel ID from conversations.open
        text: text,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });

    console.log(`[Slack] DM HTTP status: ${response.status}`);
    
    const result = await response.json();
    console.log('[Slack] DM response:', JSON.stringify(result).substring(0, 500));

    if (!result.ok) {
      console.error('[Slack] DM error:', result.error, result.response_metadata || '');
      return { ok: false, error: result.error || 'Unknown Slack error' };
    }

    console.log(`[Slack] DM sent successfully to channel ${dmChannelId}, ts: ${result.ts}`);
    return { ok: true, ts: result.ts };
  } catch (error) {
    console.error('[Slack] DM fetch error:', error);
    return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Look up a Slack user by email
async function findSlackUserByEmail(email: string): Promise<string | null> {
  if (!SLACK_BOT_TOKEN) {
    return null;
  }

  try {
    const response = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      },
    });

    const result = await response.json();
    if (result.ok && result.user?.id) {
      console.log(`[Slack] Found user ${email}: ${result.user.id}`);
      return result.user.id;
    }
    console.log(`[Slack] User not found for email ${email}:`, result.error);
    return null;
  } catch (e) {
    console.error(`[Slack] Error looking up user by email:`, e);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Use anon key client for auth verification
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getUser(token);
    
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Use service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const userId = claimsData.user.id;
    const userEmail = claimsData.user.email;

    // Get user profile for sender name
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', userId)
      .single();

    const senderName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : userEmail;

    const body: SlackRequest = await req.json();
    const { channel, channelId, message, template, context, mentionUsers, directMessage, recipientUserId } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Determine target - channel or DM
    let targetChannel = channel;
    let targetDescription = channel ? `#${channel}` : '';
    let slackUserId: string | null = null;
    
    if (directMessage && recipientUserId) {
      // Check if team member exists
      if (!TEAM_MEMBERS[recipientUserId.toLowerCase()]) {
        return new Response(JSON.stringify({ error: 'Invalid team member' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      // Look up Slack user ID (tries hardcoded ID first, then email lookup)
      slackUserId = getSlackUserIdForTeamMember(recipientUserId);
      if (!slackUserId) {
        return new Response(JSON.stringify({ 
          error: `Could not find Slack user for ${recipientUserId}. Please add their Slack ID to TEAM_MEMBERS in the edge function.` 
        }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
      
      targetChannel = `@${recipientUserId}`;
      targetDescription = `DM to ${recipientUserId}`;
      
      console.log(`[send-team-slack] Sending DM to ${recipientUserId} (${slackUserId})`);
    } else if (!channel) {
      return new Response(JSON.stringify({ error: 'Channel or recipient is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Verify channel is allowed (skip for DMs)
    if (!directMessage) {
      const { data: channelConfig } = await supabase
        .from('slack_channel_config')
        .select('*')
        .eq('channel_name', channel)
        .eq('is_active', true)
        .single();

      if (!channelConfig) {
        return new Response(JSON.stringify({ error: 'Invalid or inactive channel' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    }

    // Build context string
    let contextString = '';
    if (context) {
      const contextParts: string[] = [];
      
      if (context.propertyId) {
        const { data: property } = await supabase
          .from('properties')
          .select('name, address')
          .eq('id', context.propertyId)
          .single();
        if (property) {
          contextParts.push(`📍 Property: ${property.name || property.address}`);
        }
      }
      
      if (context.leadId) {
        const { data: lead } = await supabase
          .from('leads')
          .select('name, property_address')
          .eq('id', context.leadId)
          .single();
        if (lead) {
          contextParts.push(`👤 Lead: ${lead.name} (${lead.property_address || 'No address'})`);
        }
      }
      
      if (context.ownerId) {
        const { data: owner } = await supabase
          .from('property_owners')
          .select('name')
          .eq('id', context.ownerId)
          .single();
        if (owner) {
          contextParts.push(`🏠 Owner: ${owner.name}`);
        }
      }
      
      if (contextParts.length > 0) {
        contextString = '\n\n' + contextParts.join('\n');
      }
    }

    // Build full message
    let fullMessage = `*From ${senderName}:*\n${message}${contextString}`;
    
    // Add mentions if provided (look up user IDs dynamically)
    if (mentionUsers && mentionUsers.length > 0) {
      const mentions = mentionUsers.map(u => {
        const memberId = getSlackUserIdForTeamMember(u);
        return memberId ? `<@${memberId}>` : u;
      }).join(' ');
      fullMessage = `${mentions}\n\n${fullMessage}`;
    }

    // Log the message in database
    const { data: slackMessage, error: insertError } = await supabase
      .from('slack_messages')
      .insert({
        channel: targetChannel,
        message: fullMessage,
        sent_by: userId,
        sender_name: senderName,
        property_id: context?.propertyId || null,
        lead_id: context?.leadId || null,
        owner_id: context?.ownerId || null,
        template_used: template || null,
        status: 'sending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('[send-team-slack] Error logging slack message:', insertError);
    }

    // Send directly via Slack API
    let slackResult: { ok: boolean; ts?: string; error?: string };
    
    if (directMessage && slackUserId) {
      // Send as DM
      slackResult = await sendSlackDM(slackUserId, fullMessage);
    } else {
      // Send to channel - use channel ID if available from frontend, otherwise lookup
      const targetChannelId = getChannelId(channel!, channelId);
      console.log(`[Slack] Sending to channel: ${channel} -> ${targetChannelId}`);
      slackResult = await sendSlackMessage(targetChannelId, fullMessage);
    }

    // Update message status - AWAIT this properly!
    if (slackMessage) {
      const updateData = slackResult.ok
        ? { status: 'sent', slack_message_id: slackResult.ts || null }
        : { status: 'failed', error_message: slackResult.error || 'Unknown error' };
      
      console.log(`[Slack] Updating message ${slackMessage.id} with status:`, updateData);
      
      const { error: updateError } = await supabase
        .from('slack_messages')
        .update(updateData)
        .eq('id', slackMessage.id);
      
      if (updateError) {
        console.error('[Slack] Failed to update message status:', updateError);
      } else {
        console.log('[Slack] Message status updated successfully');
      }
    }

    if (!slackResult.ok) {
      console.error('[send-team-slack] Slack send failed:', slackResult.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: slackResult.error || 'Failed to send Slack message',
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[send-team-slack] Message sent to ${targetDescription} by ${senderName}`);

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: slackMessage?.id,
      slackTs: slackResult.ts,
      channel: targetChannel,
      isDM: directMessage || false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[send-team-slack] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
