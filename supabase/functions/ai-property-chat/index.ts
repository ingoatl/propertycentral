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

CRITICAL SECURITY RULES:
- NEVER share credit card numbers, bank account numbers, routing numbers, or any payment card information
- NEVER display full credit card details or sensitive financial data
- If you encounter such data, respond that you cannot share sensitive financial information for security reasons

TOOL USAGE WORKFLOW - FOLLOW THIS EXACTLY:

When a user asks about property information (WiFi, codes, cleaners, vendors, etc.):
1. ALWAYS use search_properties FIRST to find the property
2. Extract the property_id from the search results
3. IMMEDIATELY use get_property_onboarding with that property_id to get all details
4. Answer the user's question using the onboarding data

Example workflow for "who is the cleaner of villa 15":
Step 1: Call search_properties with query="villa 15"
Step 2: Get property_id from results (e.g., "abc-123")
Step 3: Call get_property_onboarding with property_id="abc-123"
Step 4: Search the tasks for cleaner information and respond

YOU MUST CALL BOTH TOOLS - searching alone is not enough!

Property name matching tips:
- "villa 15" matches "Villa Ct SE - Unit 15"
- "unit 7" matches "7th Avenue - Unit 7"
- Be flexible with partial names and addresses

Available tools and when to use them:
- search_properties: Find properties by name/address (ALWAYS USE FIRST)
- get_property_onboarding: Get WiFi, codes, vendor info (USE AFTER SEARCH)
- get_property_expenses: View expenses and costs
- get_email_insights: Check emails and action items
- get_bookings: View reservations
- get_visits: See scheduled visits
- get_faqs: Answer common questions

Always be helpful, concise, and proactive. Format responses clearly.`;

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
                        // Smart search: split query into words and search flexibly
                        const searchWords = args.query.toLowerCase().trim().split(/\s+/);
                        
                        // Build a flexible search that matches all words anywhere in name or address
                        let query = supabase.from("properties").select("*");
                        
                        // For each word, ensure it appears somewhere in name OR address
                        searchWords.forEach((word: string) => {
                          query = query.or(`name.ilike.%${word}%,address.ilike.%${word}%`);
                        });
                        
                        const { data } = await query.limit(20);
                        
                        // Further filter results to ensure ALL search words are present
                        const filteredData = (data || []).filter(property => {
                          const nameAndAddress = `${property.name} ${property.address}`.toLowerCase();
                          return searchWords.every((word: string) => nameAndAddress.includes(word));
                        });
                        
                        console.log(`Search for "${args.query}" found ${filteredData.length} properties:`, 
                          filteredData.map(p => p.name));
                        
                        result = filteredData;
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

                console.log("Making follow-up request with tool results");
                console.log("Tool results summary:", toolResults.map(r => ({ 
                  id: r.tool_call_id, 
                  length: r.content.length 
                })));
                
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
                      { 
                        role: "assistant", 
                        content: assistantMessage || "", 
                        tool_calls: pendingToolCalls 
                      },
                      ...toolResults
                    ],
                    stream: true,
                  }),
                });

                if (!followUpResponse.ok) {
                  const errorText = await followUpResponse.text();
                  console.error("Follow-up AI gateway error:", followUpResponse.status, errorText);
                  
                  // Fallback: provide raw tool results
                  const fallbackMessage = `I found information but had trouble formatting it. Here's what I found:\n\n${
                    toolResults.map((r, i) => {
                      const data = JSON.parse(r.content);
                      return `Tool ${i + 1} results: ${Array.isArray(data) ? `${data.length} items` : 'data returned'}`;
                    }).join('\n')
                  }`;
                  
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                    type: "content", 
                    content: fallbackMessage 
                  })}\n\n`));
                } else {
                  console.log("Follow-up response OK, starting stream...");
                  const followUpReader = followUpResponse.body?.getReader();
                  
                  if (!followUpReader) {
                    console.error("No follow-up reader available");
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                      type: "content", 
                      content: "I encountered an issue reading the response. Please try again." 
                    })}\n\n`));
                  } else {
                    let followUpBuffer = "";
                    let contentReceived = false;
                    
                    while (true) {
                      const { done, value } = await followUpReader.read();
                      if (done) {
                        console.log("Follow-up stream complete. Content received:", contentReceived);
                        break;
                      }

                      followUpBuffer += decoder.decode(value, { stream: true });
                      const followUpLines = followUpBuffer.split("\n");
                      followUpBuffer = followUpLines.pop() || "";

                      for (const followUpLine of followUpLines) {
                        if (!followUpLine.trim() || followUpLine.startsWith(":")) continue;
                        if (!followUpLine.startsWith("data: ")) continue;

                        const followUpData = followUpLine.slice(6);
                        if (followUpData === "[DONE]") {
                          console.log("Received [DONE] marker");
                          continue;
                        }

                        try {
                          const followUpParsed = JSON.parse(followUpData);
                          const followUpContent = followUpParsed.choices?.[0]?.delta?.content;
                          
                          if (followUpContent) {
                            contentReceived = true;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                              type: "content", 
                              content: followUpContent 
                            })}\n\n`));
                          }
                        } catch (e) {
                          console.error("Error parsing follow-up stream:", e, "Data:", followUpData.substring(0, 100));
                        }
                      }
                    }
                    
                    // If no content was received at all, send a fallback
                    if (!contentReceived) {
                      console.error("No content received from follow-up stream");
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: "content", 
                        content: "I found the information but couldn't format the response. Please try asking again." 
                      })}\n\n`));
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
