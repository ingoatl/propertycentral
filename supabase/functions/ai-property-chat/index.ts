import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Detect user query intent for smart auto-chaining
function detectQueryIntent(query: string): { 
  needsOnboardingData: boolean;
  keywords: string[];
} {
  const lower = query.toLowerCase();
  const detailKeywords = [
    'wifi', 'password', 'code', 'access', 'cleaner', 
    'vendor', 'lock', 'pin', 'entry', 'internet', 'network'
  ];
  
  const foundKeywords = detailKeywords.filter(kw => lower.includes(kw));
  
  return {
    needsOnboardingData: foundKeywords.length > 0,
    keywords: foundKeywords
  };
}

// Enhanced fallback response generator - answers from combined tool results
function generateAnswerFromToolResults(toolResults: any[], userQuery: string): string {
  const query = userQuery.toLowerCase();
  let propertyName = '';
  let propertyAddress = '';
  let onboardingTasks: any[] = [];
  
  // Parse all tool results to collect data
  for (const result of toolResults) {
    try {
      const data = JSON.parse(result.content);
      
      // Collect property info
      if (data?.properties?.[0]) {
        propertyName = data.properties[0].name;
        propertyAddress = data.properties[0].address;
      }
      
      // Collect onboarding tasks
      if (Array.isArray(data) && data[0]?.title) {
        onboardingTasks = data;
      }
    } catch (e) {
      console.error("Error parsing tool result:", e);
    }
  }
  
  // If we have both property and tasks, answer specific queries
  if (onboardingTasks.length > 0 && propertyName) {
    // WiFi query
    if (/wifi|password|internet/i.test(query)) {
      const wifiTask = onboardingTasks.find(t => 
        /wifi|password|network|internet/i.test(t.title || '')
      );
      if (wifiTask?.field_value) {
        return `**WiFi information for ${propertyName}:**\n\n${wifiTask.field_value}`;
      }
      return `I found ${propertyName} but the WiFi information hasn't been added to the onboarding tasks yet.`;
    }
    
    // Access code query
    if (/code|access|lock|pin|entry/i.test(query)) {
      const accessTasks = onboardingTasks.filter(t =>
        /code|access|lock|pin|entry|door/i.test(t.title || '')
      );
      if (accessTasks.length > 0) {
        const accessInfo = accessTasks
          .filter(t => t.field_value)
          .map(t => `• **${t.title}:** ${t.field_value}`)
          .join('\n');
        return accessInfo 
          ? `**Access information for ${propertyName}:**\n\n${accessInfo}`
          : `I found access tasks for ${propertyName} but they haven't been completed yet.`;
      }
    }
    
    // Cleaner query
    if (/clean|cleaner|housekeep/i.test(query)) {
      const cleanerTask = onboardingTasks.find(t =>
        /clean|housekeep/i.test(t.title || '')
      );
      if (cleanerTask?.field_value) {
        return `**Cleaner information for ${propertyName}:**\n\n${cleanerTask.field_value}`;
      }
      return `I found ${propertyName} but the cleaner information hasn't been added yet.`;
    }
    
    // Vendor query
    if (/vendor|contact/i.test(query)) {
      const vendorTasks = onboardingTasks.filter(t =>
        /vendor|contact/i.test(t.title || '')
      );
      if (vendorTasks.length > 0) {
        const vendorInfo = vendorTasks
          .filter(t => t.field_value)
          .map(t => `• **${t.title}:** ${t.field_value}`)
          .join('\n');
        return vendorInfo 
          ? `**Vendor information for ${propertyName}:**\n\n${vendorInfo}`
          : `I found vendor tasks for ${propertyName} but they haven't been completed yet.`;
      }
    }
    
    // Generic onboarding summary
    const completed = onboardingTasks.filter(t => t.status === 'completed').length;
    const tasksWithData = onboardingTasks.filter(t => t.field_value).length;
    return `I found ${onboardingTasks.length} onboarding tasks for ${propertyName}:\n• ${completed} completed\n• ${tasksWithData} have data filled in\n\nWhat specific information do you need? (e.g., WiFi, access codes, cleaner, vendors)`;
  }
  
  // If we only have property info
  if (propertyName) {
    return `I found ${propertyName} at ${propertyAddress}, but I couldn't retrieve the onboarding details. The property might not have onboarding tasks set up yet.`;
  }
  
  return "I couldn't find the information you're looking for. Could you try rephrasing your question?";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const tools = [
      {
        type: "function",
        function: {
          name: "search_properties",
          description: "Search for properties by name or address. Returns properties with id (UUID), name, address, visit price, and rental type. YOU MUST use the id field from results when calling other tools.",
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
          description: "Get onboarding tasks and details for a specific property using its UUID. Use this to find access codes, WiFi passwords, vendor information, cleaner details, etc. The property_id parameter must be the exact UUID from search_properties results.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "The UUID of the property from search_properties results (e.g., 'a439a2d4-1f0f-4235-b4c1-88651f3b8bb1')"
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
      },
      {
        type: "function",
        function: {
          name: "search_business_knowledge",
          description: "Search the Peachhaus business knowledge base for policies, procedures, cleaning guides, HOA rules, operational documents, and company information. Use this when users ask about how things work, company policies, cleaning procedures, property rules, or general business operations.",
          parameters: {
            type: "object",
            properties: {
              query: { 
                type: "string",
                description: "The search query to find relevant business knowledge"
              },
              max_results: {
                type: "number",
                description: "Maximum number of results to return (1-10, default 5)"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "save_memory",
          description: "Save important information to long-term memory. Use this when users say 'remember this', 'save this', 'from now on', give specific instructions, mention schedules/cron jobs, or explain processes. Categories: 'command' (instructions), 'cron_schedule' (recurring tasks), 'process' (workflows), 'preference' (how things should be done), 'general' (other important info).",
          parameters: {
            type: "object",
            properties: {
              content: { 
                type: "string",
                description: "The information to remember"
              },
              category: {
                type: "string",
                enum: ["command", "cron_schedule", "process", "preference", "general"],
                description: "Category of the memory"
              },
              context: {
                type: "string",
                description: "Additional context about the memory (e.g., property name, specific situation)"
              }
            },
            required: ["content", "category"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "recall_memory",
          description: "Search long-term memory for relevant information. Use this when users ask 'do you remember...', 'what did I say about...', or when you need context from past conversations. Also use at the start of conversations about specific topics to recall relevant past instructions.",
          parameters: {
            type: "object",
            properties: {
              query: { 
                type: "string",
                description: "Search query to find relevant memories"
              },
              category: {
                type: "string",
                enum: ["command", "cron_schedule", "process", "preference", "general"],
                description: "Optional: filter by category"
              }
            },
            required: ["query"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_property_contacts",
          description: "Get contact information associated with a property including HOA contacts, vendors, owner info, and other contacts. Use this when the user wants to email someone related to a property like HOA board, property manager, vendors, etc.",
          parameters: {
            type: "object",
            properties: {
              property_id: { 
                type: "string",
                description: "The UUID of the property"
              },
              contact_type: {
                type: "string",
                description: "Optional: Filter by type (hoa, vendor, owner, all)",
                enum: ["hoa", "vendor", "owner", "all"]
              }
            },
            required: ["property_id"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "draft_email",
          description: "Create an email draft in the inbox. Use this when the user asks you to draft, write, or compose an email. The draft will appear in the Communications inbox for review and sending. You should first use get_property_contacts to get the correct email addresses.",
          parameters: {
            type: "object",
            properties: {
              to_email: { 
                type: "string",
                description: "The recipient email address"
              },
              to_name: {
                type: "string",
                description: "The recipient name"
              },
              subject: {
                type: "string",
                description: "Email subject line"
              },
              body: {
                type: "string",
                description: "The email body content. Write professional, friendly emails appropriate for property management communications."
              },
              property_id: {
                type: "string",
                description: "Optional: The UUID of the related property"
              },
              property_name: {
                type: "string",
                description: "Optional: The name of the related property for context"
              },
              contact_type: {
                type: "string",
                description: "Optional: Type of contact (hoa, vendor, owner, tenant, other)"
              }
            },
            required: ["to_email", "subject", "body"]
          }
        }
      }
    ];

    const systemPrompt = `You are a Property Assistant AI for Peachhaus Group, an Atlanta-based property management company. Help users find information about properties, bookings, expenses, onboarding details, AND business operations.

SECURITY:
- Never share credit card numbers, bank account numbers, or financial data
- Respond with security error if you see such data

MEMORY SYSTEM:
You have long-term memory powered by Mem0. You should:
1. Use recall_memory at the start of conversations to check for relevant past instructions
2. When users say "remember this", "from now on", "always do X", use save_memory
3. Save important information automatically:
   - Commands/instructions → category: "command"
   - Cron schedules, recurring tasks → category: "cron_schedule" 
   - Business processes, workflows → category: "process"
   - Preferences, how things should be done → category: "preference"
4. Reference saved memories naturally: "As you mentioned before..." or "Following your preference..."

KNOWLEDGE BASE:
You have access to Peachhaus's internal knowledge base containing cleaning guides, HOA rules, property procedures, and operational documents. Use the search_business_knowledge tool when users ask about:
- Company policies and procedures
- Cleaning instructions or house rules
- HOA bylaws and regulations
- How to handle specific situations
- General business operations

PROPERTY WORKFLOW:
1. User asks about property → Call search_properties (returns property with id, name, address)
2. Extract the "id" field from the property object in the results
3. Call get_property_onboarding with that exact id
4. Answer based on the onboarding task data

EXAMPLE:
User: "What's the WiFi for Villa 15?"
Step 1: search_properties({"query": "Villa 15"})
Result: [{"id": "a439a2d4-1f0f-4235-b4c1-88651f3b8bb1", "name": "Villa Ct SE - Unit 15", ...}]
Step 2: Extract id = "a439a2d4-1f0f-4235-b4c1-88651f3b8bb1"
Step 3: get_property_onboarding({"property_id": "a439a2d4-1f0f-4235-b4c1-88651f3b8bb1"})
Step 4: Find WiFi task in results and answer

CRITICAL: Always use the exact UUID "id" from search results. Never invent property IDs like "prop_123"!

TOOLS:
- search_properties: Find properties by name/address
- get_property_onboarding: Get property details, tasks, vendors, access codes
- get_property_contacts: Get HOA, vendor, and owner contact info for a property
- get_property_expenses: View expenses
- get_email_insights: Email notifications
- get_bookings: Reservations
- get_visits: Scheduled visits
- get_faqs: FAQs
- search_business_knowledge: Search company knowledge base for policies, procedures, guides
- save_memory: Save important information to long-term memory
- recall_memory: Search past memories for relevant context
- draft_email: Create an email draft in the inbox

EMAIL DRAFTING:
When a user asks you to draft/write/compose an email (e.g., "draft an email to the HOA at Piedmont"), you should:
1. First search for the property using search_properties
2. Get the property contacts using get_property_contacts to find the HOA email
3. Use draft_email to create the draft with proper recipient, subject, and body
4. Let the user know the draft has been created and is in Communications > Inbox

When citing information from the knowledge base, mention the source document if available.
Be helpful and concise.`;

    let pendingToolCalls: any[] = [];
    let assistantMessage = "";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
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
                const userQuery = messages[messages.length - 1]?.content || "";
                const queryIntent = detectQueryIntent(userQuery);
                let searchedProperty: any = null;
                
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
                        
                        result = {
                          properties: filteredData,
                          message: filteredData.length > 0 
                            ? `Found ${filteredData.length} properties.`
                            : "No properties found."
                        };
                        
                        // Store for potential auto-chaining
                        if (filteredData.length === 1) {
                          searchedProperty = filteredData[0];
                        }
                        break;
                      }
                      case "get_property_onboarding": {
                        const { data: projects } = await supabase
                          .from("onboarding_projects")
                          .select("id, created_at, progress")
                          .eq("property_id", args.property_id)
                          .order("created_at", { ascending: false });
                        
                        if (projects && projects.length > 0) {
                          // Use most recent project
                          const project = projects[0];
                          
                          if (projects.length > 1) {
                            console.log(`Warning: Found ${projects.length} projects for property ${args.property_id}, using most recent`);
                          }
                          
                          const { data: tasks } = await supabase
                            .from("onboarding_tasks")
                            .select("title, field_value, status, phase_title, notes, phase_number")
                            .eq("project_id", project.id)
                            .order("phase_number");
                          
                          // Filter out sensitive financial data and return only essential fields
                          const safeTasks = (tasks || []).map(task => ({
                            title: task.title,
                            field_value: task.field_value && 
                              (task.field_value.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/) || 
                               task.title?.toLowerCase().includes('credit card') ||
                               task.title?.toLowerCase().includes('bank account'))
                              ? '[REDACTED]'
                              : task.field_value,
                            status: task.status,
                            phase_title: task.phase_title,
                            notes: task.notes
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
                      case "search_business_knowledge": {
                        const vectorStoreId = Deno.env.get('OPENAI_VECTOR_STORE_ID');
                        if (!vectorStoreId) {
                          result = { error: "Knowledge base not configured", results: [] };
                          break;
                        }
                        
                        const maxResults = Math.min(Math.max(1, args.max_results || 5), 10);
                        
                        try {
                          const searchResponse = await fetch(
                            `https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`,
                            {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                query: args.query,
                                max_num_results: maxResults,
                                rewrite_query: true,
                                ranking_options: { ranker: "auto" }
                              }),
                            }
                          );
                          
                          if (!searchResponse.ok) {
                            console.error('Vector store search error:', searchResponse.status);
                            result = { error: "Knowledge base search failed", results: [] };
                            break;
                          }
                          
                          const searchData = await searchResponse.json();
                          const searchResults = (searchData.data || []).map((r: any) => ({
                            filename: r.filename,
                            score: r.score,
                            content: Array.isArray(r.content) 
                              ? r.content.map((c: any) => c.text || '').join('\n')
                              : '',
                          }));
                          
                          console.log(`Knowledge base search for "${args.query}" found ${searchResults.length} results`);
                          result = {
                            query: args.query,
                            results: searchResults,
                            message: searchResults.length > 0 
                              ? `Found ${searchResults.length} relevant documents`
                              : "No relevant documents found"
                          };
                        } catch (error) {
                          console.error('Knowledge base search error:', error);
                          result = { error: "Knowledge base search failed", results: [] };
                        }
                        break;
                      }
                      case "save_memory": {
                        const MEM0_API_KEY = Deno.env.get('MEM0_API_KEY');
                        if (!MEM0_API_KEY) {
                          result = { error: "Memory system not configured", saved: false };
                          break;
                        }
                        
                        try {
                          const memoryResponse = await fetch('https://api.mem0.ai/v1/memories/', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Token ${MEM0_API_KEY}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                              messages: [
                                { role: 'user', content: args.content },
                                { role: 'assistant', content: `Saved: ${args.content}` }
                              ],
                              user_id: 'peachhaus_team',
                              metadata: {
                                category: args.category || 'general',
                                context: args.context || '',
                              }
                            }),
                          });
                          
                          if (!memoryResponse.ok) {
                            const errorText = await memoryResponse.text();
                            console.error('Mem0 save error:', errorText);
                            result = { error: "Failed to save memory", saved: false };
                            break;
                          }
                          
                          const saveResult = await memoryResponse.json();
                          console.log('Memory saved:', JSON.stringify(saveResult, null, 2));
                          result = {
                            saved: true,
                            category: args.category,
                            message: `Memory saved to category: ${args.category}`
                          };
                        } catch (error) {
                          console.error('Memory save error:', error);
                          result = { error: "Failed to save memory", saved: false };
                        }
                        break;
                      }
                      case "recall_memory": {
                        const MEM0_API_KEY = Deno.env.get('MEM0_API_KEY');
                        if (!MEM0_API_KEY) {
                          result = { error: "Memory system not configured", memories: [] };
                          break;
                        }
                        
                        try {
                          const searchBody: any = {
                            query: args.query,
                            user_id: 'peachhaus_team',
                            limit: 10,
                          };
                          
                          if (args.category) {
                            searchBody.filters = { category: args.category };
                          }
                          
                          const memoryResponse = await fetch('https://api.mem0.ai/v1/memories/search/', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Token ${MEM0_API_KEY}`,
                              'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(searchBody),
                          });
                          
                          if (!memoryResponse.ok) {
                            const errorText = await memoryResponse.text();
                            console.error('Mem0 search error:', errorText);
                            result = { error: "Failed to search memories", memories: [] };
                            break;
                          }
                          
                          const searchResult = await memoryResponse.json();
                          const memories = (searchResult.results || searchResult || []).map((m: any) => ({
                            memory: m.memory,
                            category: m.metadata?.category || 'general',
                            score: m.score,
                            created_at: m.created_at,
                          }));
                          
                          console.log(`Memory search for "${args.query}" found ${memories.length} results`);
                          result = {
                            query: args.query,
                            memories,
                            message: memories.length > 0 
                              ? `Found ${memories.length} relevant memories`
                              : "No relevant memories found"
                          };
                        } catch (error) {
                          console.error('Memory search error:', error);
                          result = { error: "Failed to search memories", memories: [] };
                        }
                        break;
                      }
                      case "get_property_contacts": {
                        // Get contacts associated with a property (HOA, vendors, owner)
                        const contacts: any = { property_id: args.property_id, contacts: [] };
                        
                        // Get property with owner info
                        const { data: property } = await supabase
                          .from("properties")
                          .select(`
                            id, name, address,
                            property_owners(id, name, email, phone)
                          `)
                          .eq("id", args.property_id)
                          .single();
                        
                        if (property) {
                          contacts.property_name = property.name;
                          contacts.property_address = property.address;
                          
                          // Add owner contact
                          if (property.property_owners && (!args.contact_type || args.contact_type === "all" || args.contact_type === "owner")) {
                            const owner = property.property_owners as any;
                            contacts.contacts.push({
                              type: "owner",
                              name: owner.name,
                              email: owner.email,
                              phone: owner.phone
                            });
                          }
                        }
                        
                        // Get HOA info from onboarding tasks
                        if (!args.contact_type || args.contact_type === "all" || args.contact_type === "hoa") {
                          const { data: project } = await supabase
                            .from("onboarding_projects")
                            .select("id")
                            .eq("property_id", args.property_id)
                            .maybeSingle();
                          
                          if (project) {
                            const { data: hoaTasks } = await supabase
                              .from("onboarding_tasks")
                              .select("title, field_value")
                              .eq("project_id", project.id)
                              .or("title.ilike.%hoa%,title.ilike.%homeowner%,title.ilike.%association%");
                            
                            if (hoaTasks && hoaTasks.length > 0) {
                              for (const task of hoaTasks) {
                                if (task.field_value) {
                                  // Try to extract email from field value
                                  const emailMatch = task.field_value.match(/[\w.-]+@[\w.-]+\.\w+/);
                                  contacts.contacts.push({
                                    type: "hoa",
                                    name: task.title,
                                    email: emailMatch ? emailMatch[0] : null,
                                    details: task.field_value
                                  });
                                }
                              }
                            }
                          }
                        }
                        
                        // Get vendors
                        if (!args.contact_type || args.contact_type === "all" || args.contact_type === "vendor") {
                          const { data: vendors } = await supabase
                            .from("vendors")
                            .select("id, name, email, phone, specialty")
                            .limit(10);
                          
                          if (vendors) {
                            for (const vendor of vendors) {
                              contacts.contacts.push({
                                type: "vendor",
                                name: vendor.name,
                                email: vendor.email,
                                phone: vendor.phone,
                                specialty: vendor.specialty
                              });
                            }
                          }
                        }
                        
                        result = contacts;
                        break;
                      }
                      case "draft_email": {
                        // Create an email draft in the email_drafts table
                        const { data: draft, error: draftError } = await supabase
                          .from("email_drafts")
                          .insert({
                            to_email: args.to_email,
                            to_name: args.to_name || null,
                            subject: args.subject,
                            body: args.body,
                            property_id: args.property_id || null,
                            property_name: args.property_name || null,
                            contact_type: args.contact_type || null,
                            ai_generated: true,
                            status: "draft"
                          })
                          .select()
                          .single();
                        
                        if (draftError) {
                          console.error("Error creating email draft:", draftError);
                          result = { 
                            success: false, 
                            error: draftError.message 
                          };
                        } else {
                          result = {
                            success: true,
                            draft_id: draft.id,
                            message: `Email draft created successfully. You can find it in Communications > Inbox.`,
                            draft: {
                              to: args.to_email,
                              to_name: args.to_name,
                              subject: args.subject,
                              property: args.property_name
                            }
                          };
                        }
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
                
                // AUTO-CHAIN: If user query needs onboarding data and we found exactly 1 property,
                // automatically fetch onboarding even if AI didn't explicitly call it
                if (queryIntent.needsOnboardingData && searchedProperty) {
                  const alreadyCalledOnboarding = pendingToolCalls.some(
                    tc => tc.function.name === "get_property_onboarding"
                  );
                  
                  if (!alreadyCalledOnboarding) {
                    console.log("Auto-chaining: User asked for details, calling get_property_onboarding for", searchedProperty.name);
                    
                    try {
                      const { data: projects } = await supabase
                        .from("onboarding_projects")
                        .select("id, created_at, progress")
                        .eq("property_id", searchedProperty.id)
                        .order("created_at", { ascending: false });
                      
                      let onboardingResult: any[] = [];
                      if (projects && projects.length > 0) {
                        const project = projects[0];
                        const { data: tasks } = await supabase
                          .from("onboarding_tasks")
                          .select("title, field_value, status, phase_title, notes, phase_number")
                          .eq("project_id", project.id)
                          .order("phase_number");
                        
                        const safeTasks = (tasks || []).map(task => ({
                          title: task.title,
                          field_value: task.field_value && 
                            (task.field_value.match(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/) || 
                             task.title?.toLowerCase().includes('credit card') ||
                             task.title?.toLowerCase().includes('bank account'))
                            ? '[REDACTED]'
                            : task.field_value,
                          status: task.status,
                          phase_title: task.phase_title,
                          notes: task.notes
                        }));
                        onboardingResult = safeTasks;
                      }
                      
                      toolResults.push({
                        role: "tool",
                        tool_call_id: `auto_chain_${Date.now()}`,
                        content: JSON.stringify(onboardingResult)
                      });
                      
                      console.log("Auto-chained onboarding data:", onboardingResult.length, "tasks");
                    } catch (error) {
                      console.error("Error in auto-chaining:", error);
                    }
                  }
                }

                console.log("Making follow-up request with tool results");
                console.log("Tool results summary:", toolResults.map(r => ({ 
                  id: r.tool_call_id, 
                  length: r.content.length 
                })));
                
                const followUpMessages = [
                  { role: "system", content: systemPrompt },
                  ...messages,
                  { 
                    role: "assistant", 
                    content: assistantMessage || "", 
                    tool_calls: pendingToolCalls 
                  },
                  ...toolResults
                ];
                
                console.log("Follow-up conversation context:", {
                  messageCount: followUpMessages.length,
                  lastUserMessage: messages[messages.length - 1]?.content?.substring(0, 100),
                  toolCallCount: pendingToolCalls.length
                });
                
                const followUpResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: followUpMessages,
                    stream: true,
                  }),
                });

                if (!followUpResponse.ok) {
                  const errorText = await followUpResponse.text();
                  console.error("Follow-up OpenAI API error:", followUpResponse.status, errorText);
                  
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
                    
                    // If no content was received, generate a smart fallback from tool results
                    if (!contentReceived) {
                      console.error("No content received from follow-up stream, generating fallback");
                      const userQuery = messages[messages.length - 1]?.content || "";
                      const fallbackAnswer = generateAnswerFromToolResults(toolResults, userQuery);
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                        type: "content", 
                        content: fallbackAnswer 
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
