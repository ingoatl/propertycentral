import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tools = [
      {
        type: "function",
        function: {
          name: "search_properties",
          description: "Search for properties by name or address. Returns property details including name, address, visit price, and rental type.",
          parameters: {
            type: "object",
            properties: {
              query: { 
                type: "string",
                description: "Search query for property name or address"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_property_onboarding",
          description: "Get onboarding tasks and details for a specific property. Use this to find access codes, WiFi passwords, vendor information, etc.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "The UUID of the property"
              }
            },
            required: ["property_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_property_expenses",
          description: "Get expenses for a specific property or all properties. Can filter by date range.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "Optional: The UUID of the property to filter by"
              },
              start_date: {
                type: "string",
                description: "Optional: Start date in YYYY-MM-DD format"
              },
              end_date: {
                type: "string",
                description: "Optional: End date in YYYY-MM-DD format"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_email_insights",
          description: "Get email insights for a property. Shows important emails, action items, and suggested actions.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "The UUID of the property"
              },
              status: {
                type: "string",
                description: "Optional: Filter by status (new, reviewed, archived)",
                enum: ["new", "reviewed", "archived"]
              }
            },
            required: ["property_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_bookings",
          description: "Get bookings from OwnerRez for a property or all properties.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "Optional: The UUID of the property to filter by"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_visits",
          description: "Get scheduled visits for properties. Can filter by property and date range.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "Optional: The UUID of the property to filter by"
              },
              start_date: {
                type: "string",
                description: "Optional: Start date in YYYY-MM-DD format"
              }
            }
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_faqs",
          description: "Get frequently asked questions for a property or all properties.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "Optional: The UUID of the property to filter by"
              },
              query: {
                type: "string",
                description: "Optional: Search query to filter FAQs"
              }
            }
          }
        }
      }
    ];

    const systemPrompt = `You are an AI Property Assistant for a property management system. You help users find information about their properties, bookings, expenses, email insights, visits, and onboarding details.

Key capabilities:
- Search for properties and get their details
- Access onboarding information (WiFi codes, access codes, vendor contacts, etc.)
- View and analyze expenses
- Check email insights and action items
- View bookings and visits
- Answer frequently asked questions

CRITICAL SECURITY RULES:
- NEVER share credit card numbers, bank account numbers, routing numbers, or any payment card information
- NEVER display full credit card details or sensitive financial data
- If you encounter such data, respond that you cannot share sensitive financial information for security reasons

IMPORTANT WORKFLOW INSTRUCTIONS:
- When asked about property-specific information (WiFi, codes, addresses, etc.), ALWAYS:
  1. First use search_properties to find the property by name or address
  2. Once you have the property_id, use get_property_onboarding to get the details
  3. Then extract and share the specific information requested
- Be smart about property names - "villa 15" should match "Villa Ct SE - Unit 15"
- Always chain tool calls together - don't stop after just searching
- When you find a property, proactively get its onboarding details if the user is asking about property-specific info

Always be helpful, concise, and proactive. Format your responses in a clear, organized way.`;

    let pendingToolCalls: any[] = [];
    let assistantMessage = "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: "auto",
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim() || line.startsWith(":")) continue;
            if (!line.startsWith("data: ")) continue;

            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                assistantMessage += delta.content;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", content: delta.content })}\n\n`));
              }

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (!pendingToolCalls[toolCall.index]) {
                    pendingToolCalls[toolCall.index] = {
                      id: toolCall.id,
                      type: "function",
                      function: { name: toolCall.function?.name || "", arguments: "" }
                    };
                  }
                  if (toolCall.function?.arguments) {
                    pendingToolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                  }
                }
              }

              const finishReason = parsed.choices?.[0]?.finish_reason;
              if (finishReason === "tool_calls" && pendingToolCalls.length > 0) {
                console.log("Processing tool calls:", pendingToolCalls);
                
                const toolResults = [];
                for (const toolCall of pendingToolCalls) {
                  const functionName = toolCall.function.name;
                  const args = JSON.parse(toolCall.function.arguments);
                  console.log(`Executing ${functionName} with args:`, args);

                  let result;
                  try {
                    switch (functionName) {
                      case "search_properties": {
                        const { data } = await supabase
                          .from("properties")
                          .select("*")
                          .or(`name.ilike.%${args.query}%,address.ilike.%${args.query}%`)
                          .limit(10);
                        result = data || [];
                        break;
                      }
                      case "get_property_onboarding": {
                        const { data: project } = await supabase
                          .from("onboarding_projects")
                          .select("id")
                          .eq("property_id", args.property_id)
                          .single();
                        
                        if (project) {
                          const { data: tasks } = await supabase
                            .from("onboarding_tasks")
                            .select("*")
                            .eq("project_id", project.id)
                            .order("phase_number");
                          
                          // Filter out any sensitive financial data
                          const safeTasks = (tasks || []).map(task => ({
                            ...task,
                            // Remove sensitive fields if they contain credit card or bank info
                            field_value: task.field_value && 
                              (task.field_value.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/) || 
                               task.title?.toLowerCase().includes('credit card') ||
                               task.title?.toLowerCase().includes('bank account'))
                              ? '[REDACTED - Sensitive Financial Data]'
                              : task.field_value
                          }));
                          result = safeTasks;
                        } else {
                          result = [];
                        }
                        break;
                      }
                      case "get_property_expenses": {
                        let query = supabase.from("expenses").select("*");
                        if (args.property_id) query = query.eq("property_id", args.property_id);
                        if (args.start_date) query = query.gte("date", args.start_date);
                        if (args.end_date) query = query.lte("date", args.end_date);
                        const { data } = await query.order("date", { ascending: false }).limit(50);
                        
                        // Filter out sensitive payment information
                        const safeExpenses = (data || []).map(expense => ({
                          ...expense,
                          // Remove any credit card or bank details from purpose/notes
                          purpose: expense.purpose?.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '[REDACTED]'),
                          order_number: expense.order_number // Keep order numbers as they're not sensitive
                        }));
                        result = safeExpenses;
                        break;
                      }
                      case "get_email_insights": {
                        let query = supabase
                          .from("email_insights")
                          .select("*")
                          .eq("property_id", args.property_id);
                        if (args.status) query = query.eq("status", args.status);
                        const { data } = await query.order("email_date", { ascending: false }).limit(20);
                        result = data || [];
                        break;
                      }
                      case "get_bookings": {
                        let query = supabase.from("ownerrez_bookings").select("*");
                        if (args.property_id) query = query.eq("property_id", args.property_id);
                        const { data } = await query.order("check_in", { ascending: false }).limit(50);
                        result = data || [];
                        break;
                      }
                      case "get_visits": {
                        let query = supabase.from("visits").select("*, properties(name, address)");
                        if (args.property_id) query = query.eq("property_id", args.property_id);
                        if (args.start_date) query = query.gte("date", args.start_date);
                        const { data } = await query.order("date", { ascending: true }).limit(50);
                        result = data || [];
                        break;
                      }
                      case "get_faqs": {
                        let query = supabase.from("frequently_asked_questions").select("*");
                        if (args.property_id) query = query.eq("property_id", args.property_id);
                        if (args.query) {
                          query = query.or(`question.ilike.%${args.query}%,answer.ilike.%${args.query}%`);
                        }
                        const { data } = await query.limit(20);
                        result = data || [];
                        break;
                      }
                      default:
                        result = { error: "Unknown function" };
                    }
                  } catch (error) {
                    console.error(`Error executing ${functionName}:`, error);
                    result = { error: error instanceof Error ? error.message : "Unknown error" };
                  }

                  toolResults.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                  });
                }

                const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${LOVABLE_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "google/gemini-2.5-flash",
                    messages: [
                      { role: "system", content: systemPrompt },
                      ...messages,
                      { role: "assistant", content: assistantMessage || null, tool_calls: pendingToolCalls },
                      ...toolResults
                    ],
                    stream: true,
                  }),
                });

                const followUpReader = followUpResponse.body?.getReader();
                if (followUpReader) {
                  let followUpBuffer = "";
                  while (true) {
                    const { done, value } = await followUpReader.read();
                    if (done) break;

                    followUpBuffer += decoder.decode(value, { stream: true });
                    const followUpLines = followUpBuffer.split("\n");
                    followUpBuffer = followUpLines.pop() || "";

                    for (const followUpLine of followUpLines) {
                      if (!followUpLine.trim() || followUpLine.startsWith(":")) continue;
                      if (!followUpLine.startsWith("data: ")) continue;

                      const followUpData = followUpLine.slice(6);
                      if (followUpData === "[DONE]") continue;

                      try {
                        const followUpParsed = JSON.parse(followUpData);
                        const followUpContent = followUpParsed.choices?.[0]?.delta?.content;
                        if (followUpContent) {
                          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", content: followUpContent })}\n\n`));
                        }
                      } catch (e) {
                        console.error("Error parsing follow-up stream:", e);
                      }
                    }
                  }
                }
              }
            } catch (e) {
              console.error("Error parsing stream:", e);
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
