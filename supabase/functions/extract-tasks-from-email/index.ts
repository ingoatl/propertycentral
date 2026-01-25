import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedTask {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  source_quote?: string;
  phase_suggestion?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailInsightId, propertyId, ownerId, subject, summary, body, suggestedActions, senderEmail } = await req.json();

    console.log('extract-tasks-from-email called for emailInsightId:', emailInsightId);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // If no propertyId, we can't create tasks
    if (!propertyId) {
      console.log('No propertyId provided, skipping task extraction');
      return new Response(
        JSON.stringify({ success: false, reason: 'No property linked to email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get property and owner details
    const { data: property } = await supabase
      .from('properties')
      .select('id, name, address, owner_id')
      .eq('id', propertyId)
      .single();

    if (!property) {
      console.log('Property not found:', propertyId);
      return new Response(
        JSON.stringify({ success: false, reason: 'Property not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ownerIdToUse = ownerId || property.owner_id;

    // Call AI to extract tasks
    const systemPrompt = `You are an AI assistant that extracts actionable setup tasks from property management communications.

Analyze the email content and extract discrete, actionable tasks that need to be done for property setup/onboarding.

**FOCUS ON TASKS LIKE:**
- WiFi setup (setting code, name, password)
- Access codes (lockbox, gate, alarm codes)
- Trash/garbage schedule or location
- HOA requirements or restrictions
- Utility account setup
- Smart home device configuration
- Key/lockbox installation
- Photography scheduling
- Cleaning preferences
- Pet policies
- Guest rules
- Special instructions from owner

**DO NOT CREATE TASKS FOR:**
- Purchase confirmations (these are expenses, not tasks)
- Shipping notifications
- Payment receipts
- Booking confirmations
- Marketing emails
- Newsletters

**TASK CATEGORY MAPPING TO PHASES:**
- WiFi/Internet setup → Phase 3 (Technology & Security)
- Access codes (lockbox, gate, alarm) → Phase 2 (Property Access)
- Trash/utilities → Phase 4 (Utilities & Services)
- Cleaning/housekeeping → Phase 5 (Operations)
- Guest rules/policies → Phase 6 (Guest Experience)
- Photography → Phase 8 (Marketing)
- Legal/insurance → Phase 1 (Legal & Compliance)
- General property info → Phase 7 (Property Details)

Return a JSON object with an array of tasks:
{
  "tasks": [
    {
      "title": "Short task title (5-10 words)",
      "description": "Detailed task description with specific values/info from email",
      "priority": "low" | "medium" | "high" | "urgent",
      "category": "wifi_setup" | "access_codes" | "trash" | "utilities" | "cleaning" | "guest_rules" | "photography" | "legal" | "hoa" | "smart_home" | "other",
      "source_quote": "Exact relevant quote from email",
      "phase_suggestion": number (1-8)
    }
  ],
  "no_tasks_reason": "Reason if no tasks extracted (optional)"
}

If the email contains no actionable tasks, return: { "tasks": [], "no_tasks_reason": "..." }`;

    const userPrompt = `Email for property: ${property.name} (${property.address})

From: ${senderEmail || 'Unknown'}
Subject: ${subject}
Summary: ${summary}
Suggested Actions: ${suggestedActions || 'None'}

Full Content:
${body?.substring(0, 3000) || 'No body content'}

Extract actionable setup/onboarding tasks from this email.`;

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const error = await aiResponse.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error}`);
    }

    const aiResult = await aiResponse.json();
    const responseContent = aiResult.choices[0]?.message?.content;

    if (!responseContent) {
      console.log('No content in AI response');
      return new Response(
        JSON.stringify({ success: false, reason: 'No AI response content' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsedResponse: { tasks: ExtractedTask[]; no_tasks_reason?: string };
    try {
      parsedResponse = JSON.parse(responseContent);
    } catch (e) {
      console.error('Failed to parse AI response:', responseContent);
      return new Response(
        JSON.stringify({ success: false, reason: 'Failed to parse AI response' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const extractedTasks = parsedResponse.tasks || [];
    console.log(`Extracted ${extractedTasks.length} tasks from email`);

    if (extractedTasks.length === 0) {
      console.log('No tasks extracted:', parsedResponse.no_tasks_reason);
      return new Response(
        JSON.stringify({ 
          success: true, 
          tasksCreated: 0, 
          reason: parsedResponse.no_tasks_reason || 'No actionable tasks found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create pending_task_confirmations for each extracted task
    const confirmationsToInsert = [];
    
    for (const task of extractedTasks) {
      // Check for duplicates by title similarity
      const { data: existingConfirmations } = await supabase
        .from('pending_task_confirmations')
        .select('id, task_title')
        .eq('property_id', propertyId)
        .eq('status', 'pending');

      const isDuplicate = existingConfirmations?.some(existing => 
        existing.task_title.toLowerCase().includes(task.title.toLowerCase().substring(0, 20)) ||
        task.title.toLowerCase().includes(existing.task_title.toLowerCase().substring(0, 20))
      );

      if (isDuplicate) {
        console.log('Skipping duplicate task:', task.title);
        continue;
      }

      confirmationsToInsert.push({
        property_id: propertyId,
        owner_id: ownerIdToUse,
        source_type: 'email',
        source_id: emailInsightId,
        task_title: task.title,
        task_description: task.description,
        task_priority: task.priority,
        task_category: task.category,
        source_quote: task.source_quote,
        phase_suggestion: task.phase_suggestion,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
      });
    }

    if (confirmationsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ success: true, tasksCreated: 0, reason: 'All tasks were duplicates' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('pending_task_confirmations')
      .insert(confirmationsToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting pending confirmations:', insertError);
      throw insertError;
    }

    console.log(`Created ${inserted?.length || 0} pending task confirmations`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        tasksCreated: inserted?.length || 0,
        tasks: inserted 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in extract-tasks-from-email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
