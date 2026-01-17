import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SlackRequest {
  channel?: string;
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

// Team member mapping - emails to try (in order) and optional direct Slack ID
// Add your Slack user IDs here for instant lookup (find via: click profile → ⋮ → Copy member ID)
const TEAM_MEMBERS: Record<string, { emails: string[]; slackId?: string }> = {
  'alex': { 
    emails: ['alex@peachhausgroup.com', 'alex@peachhg.com'],
    // slackId: 'U0123456789' // Add actual Slack ID here
  },
  'anja': { 
    emails: ['anja@peachhausgroup.com', 'anja@peachhg.com'],
    // slackId: 'U0123456789'
  },
  'catherine': { 
    emails: ['catherine@peachhausgroup.com', 'catherine@peachhg.com'],
    // slackId: 'U0123456789'
  },
  'chris': { 
    emails: ['chris@peachhausgroup.com', 'chris@peachhg.com'],
    // slackId: 'U0123456789'
  },
  'ingo': { 
    emails: ['ingo@peachhausgroup.com', 'ingo@peachhg.com'],
    // slackId: 'U0123456789'
  },
};

// Cache for Slack user IDs (email -> slackId)
const slackUserCache: Record<string, string> = {};

// Find Slack user ID for a team member (tries direct ID first, then email lookup)
async function getSlackUserIdForTeamMember(memberKey: string): Promise<string | null> {
  const member = TEAM_MEMBERS[memberKey.toLowerCase()];
  if (!member) return null;
  
  // If we have a hardcoded Slack ID, use it directly
  if (member.slackId) {
    console.log(`[Slack] Using hardcoded ID for ${memberKey}: ${member.slackId}`);
    return member.slackId;
  }
  
  // Try each email address
  for (const email of member.emails) {
    const userId = await findSlackUserByEmail(email);
    if (userId) {
      console.log(`[Slack] Found user ${memberKey} via email ${email}: ${userId}`);
      return userId;
    }
  }
  
  console.log(`[Slack] Could not find Slack user for ${memberKey}`);
  return null;
}

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');

// Send message directly to Slack using the Web API
async function sendSlackMessage(channel: string, text: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN is not configured');
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  console.log(`[Slack] Sending message to channel: ${channel}`);

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

  const result = await response.json();
  console.log('[Slack] API response:', JSON.stringify(result).substring(0, 500));

  if (!result.ok) {
    console.error('[Slack] API error:', result.error);
    return { ok: false, error: result.error };
  }

  return { ok: true, ts: result.ts };
}

// Send a direct message to a user (using user ID as channel)
// This works with chat:write scope - no need for im:write
async function sendSlackDM(userId: string, text: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  if (!SLACK_BOT_TOKEN) {
    console.error('[Slack] SLACK_BOT_TOKEN is not configured');
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  console.log(`[Slack] Sending DM to user: ${userId}`);

  // Send directly to user ID - Slack will create/use the DM channel automatically
  // This works with chat:write scope
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: userId, // User ID works as channel for DMs
      text: text,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const result = await response.json();
  console.log('[Slack] DM response:', JSON.stringify(result).substring(0, 500));

  if (!result.ok) {
    console.error('[Slack] DM error:', result.error);
    return { ok: false, error: result.error };
  }

  return { ok: true, ts: result.ts };
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
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
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
    const { channel, message, template, context, mentionUsers, directMessage, recipientUserId } = body;

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
      slackUserId = await getSlackUserIdForTeamMember(recipientUserId);
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
      const mentionPromises = mentionUsers.map(async u => {
        const userId = await getSlackUserIdForTeamMember(u);
        return userId ? `<@${userId}>` : u;
      });
      const resolvedMentions = await Promise.all(mentionPromises);
      const mentions = resolvedMentions.join(' ');
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
      // Send to channel - use channel name without # prefix
      const channelName = channel?.replace('#', '');
      slackResult = await sendSlackMessage(channelName!, fullMessage);
    }

    // Update message status
    if (slackMessage) {
      const updateData = slackResult.ok
        ? { status: 'sent', slack_message_id: slackResult.ts || null }
        : { status: 'failed', error_message: slackResult.error || 'Unknown error' };
      
      await supabase
        .from('slack_messages')
        .update(updateData)
        .eq('id', slackMessage.id);
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
