import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractedAction {
  type: "schedule_call" | "send_email" | "create_task" | "request_info" | "follow_up";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  data?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conversationText, contactName, contactPhone, contactEmail, contactType } = await req.json();

    console.log("Extract smart actions for:", contactName, "type:", contactType);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are an AI assistant analyzing a conversation for a property management company (PeachHaus Group).

Your job is to extract ACTIONABLE items from the conversation that the property manager should take.

COMPANY CONTEXT:
- PeachHaus Group provides mid-term rental property management in Atlanta
- We offer a FREE income analysis for any property (shows income for short-term, mid-term, and long-term rentals)
- To create the analysis, we need: property address + email address
- Scheduling link: https://propertycentral.lovable.app/book-discovery-call

ACTIONS TO DETECT:

1. **SCHEDULE_CALL** - When the contact wants to:
   - Talk tomorrow, this week, or schedule a call
   - Meet or have a conversation
   - Discuss something in more detail
   Priority: HIGH if they mentioned a specific time, MEDIUM otherwise

2. **REQUEST_INFO** - When we're missing key info:
   - Property address (needed for income analysis)
   - Email address (especially if they only texted, needed to send reports)
   - Budget, timeline, or property details
   Priority: HIGH for address/email, MEDIUM for other details

3. **FOLLOW_UP** - When there's something we need to do:
   - Send documents or information
   - Check on something and get back to them
   - Respond to a specific question
   Priority: Based on urgency expressed

4. **SEND_EMAIL** - When we should email them:
   - They requested written information
   - We mentioned we'd send something
   Priority: MEDIUM usually

5. **CREATE_TASK** - General tasks:
   - Property inspection or visit
   - Prepare a proposal
   - Research something
   Priority: Based on context

RESPONSE FORMAT:
Return a JSON object with an "actions" array. Each action should have:
- type: one of the action types above
- title: Short, actionable title (5-10 words)
- description: What specifically needs to be done
- priority: "high", "medium", or "low"
- data: Optional object with relevant data (like suggested message text for request_info)

Example:
{
  "actions": [
    {
      "type": "schedule_call",
      "title": "Schedule call for tomorrow",
      "description": "Contact mentioned they want to talk tomorrow afternoon",
      "priority": "high"
    },
    {
      "type": "request_info",
      "title": "Get property address",
      "description": "Need property address to create free income analysis",
      "priority": "high",
      "data": {
        "message": "What's the property address? I'd love to put together that free income analysis for you!"
      }
    }
  ]
}

If there are no clear actionable items, return: { "actions": [] }

Be practical - only suggest actions that would genuinely help move the conversation forward.`;

    const userPrompt = `Analyze this conversation with ${contactName} (${contactType}):

Contact info we have:
- Phone: ${contactPhone || "Available"}
- Email: ${contactEmail || "NOT PROVIDED - may need to request"}

CONVERSATION:
${conversationText}

Extract actionable items. Remember:
- If we don't have their email and they texted, we should ask for it
- If they expressed interest in our services but we don't have their address, we need it for the income analysis
- If they want to schedule, we should make that happen`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_actions",
              description: "Extract actionable items from the conversation",
              parameters: {
                type: "object",
                properties: {
                  actions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          enum: ["schedule_call", "send_email", "create_task", "request_info", "follow_up"],
                        },
                        title: { type: "string" },
                        description: { type: "string" },
                        priority: {
                          type: "string",
                          enum: ["high", "medium", "low"],
                        },
                        data: {
                          type: "object",
                          additionalProperties: true,
                        },
                      },
                      required: ["type", "title", "description", "priority"],
                    },
                  },
                },
                required: ["actions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_actions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    let actions: ExtractedAction[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        actions = parsed.actions || [];
      } catch (e) {
        console.error("Failed to parse tool call:", e);
      }
    }

    console.log(`Extracted ${actions.length} actions for ${contactName}`);

    return new Response(
      JSON.stringify({ actions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Extract smart actions error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
