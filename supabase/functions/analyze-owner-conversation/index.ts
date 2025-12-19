import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  conversationId: string;
  transcript?: string;
  documentContents?: Array<{
    fileName: string;
    content: string;
    isStructured?: boolean;
    structuredData?: any;
  }>;
  propertyContext?: {
    id: string;
    name: string;
    address: string;
  };
}

// Helper function to normalize strings for matching
function normalizeString(str: string): string {
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper function to check if two strings are similar enough to match
function stringsMatch(a: string, b: string): boolean {
  const normA = normalizeString(a);
  const normB = normalizeString(b);
  
  // Exact match
  if (normA === normB) return true;
  
  // One contains the other
  if (normA.includes(normB) || normB.includes(normA)) return true;
  
  // Check word overlap
  const wordsA = normA.split(' ');
  const wordsB = normB.split(' ');
  const commonWords = wordsA.filter(w => wordsB.includes(w) && w.length > 2);
  
  // If more than half the words match, consider it a match
  if (commonWords.length >= Math.min(wordsA.length, wordsB.length) * 0.5) return true;
  
  return false;
}

// Map extracted data types to task matching keywords
const dataTypeToTaskKeywords: Record<string, string[]> = {
  'wifi': ['wifi', 'internet', 'network'],
  'electric': ['electric', 'electricity', 'power'],
  'gas': ['gas'],
  'water': ['water'],
  'trash': ['trash', 'garbage', 'waste'],
  'internet': ['internet', 'wifi', 'network'],
  'hoa': ['hoa', 'homeowner'],
  'security': ['security', 'alarm', 'camera'],
  'cleaner': ['cleaner', 'cleaning', 'maid'],
  'handyman': ['handyman', 'maintenance'],
  'plumber': ['plumber', 'plumbing'],
  'electrician': ['electrician'],
  'hvac': ['hvac', 'heating', 'cooling', 'ac', 'air conditioning'],
  'lockbox': ['lockbox', 'lock box'],
  'gate': ['gate'],
  'garage': ['garage'],
  'smart lock': ['smart lock', 'keyless'],
  'parking': ['parking'],
  'pet': ['pet'],
  'owner': ['owner'],
  'insurance': ['insurance'],
  'permit': ['permit', 'str', 'license'],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversationId, transcript, documentContents, propertyContext }: AnalysisRequest = await req.json();

    console.log("Analyzing conversation:", conversationId);
    console.log("Has transcript:", !!transcript);
    console.log("Document count:", documentContents?.length || 0);
    console.log("Property context:", propertyContext);

    // Update status to analyzing
    await supabase
      .from("owner_conversations")
      .update({ status: "analyzing" })
      .eq("id", conversationId);

    // Check for existing actions to prevent duplicates
    const { data: existingActions } = await supabase
      .from("owner_conversation_actions")
      .select("title, action_type")
      .eq("conversation_id", conversationId);
    
    const existingTitles = new Set((existingActions || []).map(a => `${a.action_type}:${a.title.toLowerCase()}`));
    console.log("Existing actions count:", existingTitles.size);

    // Get existing onboarding project and tasks for this property
    let existingProject: any = null;
    let existingTasks: any[] = [];
    
    if (propertyContext?.id) {
      const { data: projectData } = await supabase
        .from("onboarding_projects")
        .select("*")
        .eq("property_id", propertyContext.id)
        .maybeSingle();
      
      existingProject = projectData;
      
      if (existingProject) {
        const { data: tasksData } = await supabase
          .from("onboarding_tasks")
          .select("*")
          .eq("project_id", existingProject.id)
          .order("phase_number", { ascending: true });
        
        existingTasks = tasksData || [];
        console.log(`Found ${existingTasks.length} existing tasks for property`);
      }
    }

    // Build the content for analysis
    let contentToAnalyze = "";
    
    if (transcript) {
      contentToAnalyze += `## OWNER CONVERSATION TRANSCRIPT\n\n${transcript}\n\n`;
    }
    
    if (documentContents && documentContents.length > 0) {
      for (const doc of documentContents) {
        if (doc.isStructured && doc.structuredData) {
          contentToAnalyze += `## STRUCTURED DATA FROM: ${doc.fileName}\n\n`;
          contentToAnalyze += `This is parsed Excel/CSV data. Extract all relevant property information:\n\n`;
          contentToAnalyze += doc.content;
          contentToAnalyze += `\n\n`;
        } else {
          contentToAnalyze += `## DOCUMENT: ${doc.fileName}\n\n${doc.content}\n\n`;
        }
      }
    }

    // Enhanced system prompt
    const systemPrompt = `You are an expert property management assistant. Your job is to analyze owner conversations, property documents, and structured data (Excel/CSV) to extract actionable information.

IMPORTANT RULES:
1. For DOCUMENTS (cleaning manuals, house rules, operational guides): Focus on EXTRACTING and STRUCTURING information beautifully. Do NOT create tasks unless there's a specific action item that requires someone to DO something.
2. For TRANSCRIPTS (conversations): Identify action items, follow-ups, and property updates that were discussed.
3. For STRUCTURED DATA (Excel/CSV): Extract ALL relevant property information including:
   - Utility accounts (electric, gas, water, internet, etc.)
   - Login credentials (HOA portal, mortgage, security systems, etc.)
   - Appliance information (brand, model, serial numbers, warranty)
   - Service provider contacts (plumber, electrician, HVAC, handyman)
   - Property taxes and financial information
   - Any other relevant property data
4. Be SMART about what becomes a task vs what becomes property info. "Install lockbox" = task. "Parking is in the garage" = property info.
5. Create well-structured, formatted property information that can be easily referenced.
6. For credentials/logins, mark them as type "credential" so they can be stored securely.
7. For appliances, mark them as type "appliance" so they can be tracked.

Property Context: ${propertyContext ? `${propertyContext.name} at ${propertyContext.address}` : 'Unknown property'}

Analyze the content and return a JSON object with this exact structure:
{
  "summary": "2-3 paragraph summary of the content",
  "contentType": "transcript" | "document" | "excel" | "mixed",
  "propertyInfo": [
    {
      "category": "Cleaning|Parking|Access|Trash|Pets|Checkout|Safety|Utilities|Amenities|Contacts|Financial|Other",
      "title": "Short title",
      "items": ["Bullet point 1", "Bullet point 2"],
      "importance": "high|medium|low"
    }
  ],
  "credentials": [
    {
      "serviceName": "Service name (e.g., HOA Portal, Security System)",
      "username": "Username if available",
      "password": "Password if available",
      "url": "Login URL if available",
      "notes": "Any additional notes"
    }
  ],
  "appliances": [
    {
      "type": "Appliance type (e.g., Washer, HVAC, Water Heater)",
      "brand": "Brand name",
      "model": "Model number",
      "serialNumber": "Serial number",
      "year": "Year if known",
      "location": "Where in property",
      "warranty": "Warranty info if available"
    }
  ],
  "utilities": [
    {
      "type": "Electric|Gas|Water|Internet|Trash|HOA|Other",
      "provider": "Provider name",
      "accountNumber": "Account number",
      "phone": "Contact phone if available",
      "notes": "Any additional notes"
    }
  ],
  "contacts": [
    {
      "role": "Handyman|Plumber|Electrician|HVAC|Cleaner|Other",
      "name": "Contact name",
      "company": "Company name if applicable",
      "phone": "Phone number",
      "email": "Email if available",
      "notes": "Any additional notes"
    }
  ],
  "faqs": [
    {
      "question": "Question guests might ask",
      "answer": "The answer based on the content",
      "category": "Access|Amenities|Policies|Operations"
    }
  ],
  "setupNotes": [
    {
      "title": "Important operational note",
      "description": "Detailed description",
      "priority": "high|medium|low"
    }
  ],
  "tasks": [
    {
      "title": "Action item that needs to be done",
      "description": "What needs to happen",
      "priority": "urgent|high|medium|low",
      "category": "Setup|Maintenance|Purchase|Admin",
      "assignedTo": "peachhaus|owner",
      "isCompleted": false,
      "phaseNumber": 2,
      "phaseTitle": "Property Setup"
    }
  ]
}

CRITICAL: Only extract tasks for NEW action items. Extract property information, credentials, utilities, and contacts thoroughly.`;

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
          { role: "user", content: contentToAnalyze }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI response received, parsing...");

    // Parse the JSON from the response
    let analysisResult;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw content:", content);
      throw new Error("Failed to parse AI analysis response");
    }

    // Update the conversation with the analysis
    const { error: updateError } = await supabase
      .from("owner_conversations")
      .update({
        status: "analyzed",
        ai_summary: analysisResult.summary,
        extracted_items: analysisResult,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Failed to update conversation:", updateError);
      throw updateError;
    }

    // Track task updates and property info
    const tasksUpdated: string[] = [];
    const propertyInfoToStore: any[] = [];

    // Helper to find matching task
    const findMatchingTask = (searchTerms: string[]) => {
      for (const task of existingTasks) {
        const taskTitle = normalizeString(task.title);
        for (const term of searchTerms) {
          if (taskTitle.includes(normalizeString(term))) {
            return task;
          }
        }
      }
      return null;
    };

    // Process utilities - try to map to existing tasks
    for (const utility of analysisResult.utilities || []) {
      const utilType = utility.type?.toLowerCase() || '';
      const searchTerms = dataTypeToTaskKeywords[utilType] || [utilType];
      searchTerms.push(utility.type, utility.provider);
      
      const matchingTask = findMatchingTask(searchTerms);
      
      if (matchingTask && existingProject) {
        // Update the existing task with utility info
        const valueToSet = `${utility.provider}${utility.accountNumber ? ` - Account: ${utility.accountNumber}` : ''}${utility.phone ? ` - Phone: ${utility.phone}` : ''}`;
        const notesToAdd = utility.notes || '';
        
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({
            field_value: valueToSet,
            notes: matchingTask.notes ? `${matchingTask.notes}\n${notesToAdd}` : notesToAdd,
            status: 'completed',
            completed_date: new Date().toISOString()
          })
          .eq("id", matchingTask.id);
        
        if (!error) {
          tasksUpdated.push(matchingTask.title);
          console.log(`Updated task "${matchingTask.title}" with utility info`);
        }
      } else {
        // Store as property info
        propertyInfoToStore.push({
          type: 'utility',
          title: `Utility: ${utility.type} - ${utility.provider}`,
          description: `Account: ${utility.accountNumber || 'N/A'}\nPhone: ${utility.phone || 'N/A'}`,
          category: 'Utilities',
          content: utility
        });
      }
    }

    // Process credentials - try to map to existing tasks
    for (const cred of analysisResult.credentials || []) {
      const credName = cred.serviceName?.toLowerCase() || '';
      const searchTerms = Object.entries(dataTypeToTaskKeywords)
        .filter(([key]) => credName.includes(key))
        .flatMap(([, terms]) => terms);
      searchTerms.push(cred.serviceName);
      
      const matchingTask = findMatchingTask(searchTerms);
      
      if (matchingTask && existingProject) {
        const valueToSet = cred.username || '';
        const notesToAdd = `URL: ${cred.url || 'N/A'}\nNotes: ${cred.notes || 'N/A'}`;
        
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({
            field_value: valueToSet,
            notes: matchingTask.notes ? `${matchingTask.notes}\n${notesToAdd}` : notesToAdd,
            status: 'completed',
            completed_date: new Date().toISOString()
          })
          .eq("id", matchingTask.id);
        
        if (!error) {
          tasksUpdated.push(matchingTask.title);
          console.log(`Updated task "${matchingTask.title}" with credential info`);
        }
      } else {
        propertyInfoToStore.push({
          type: 'credential',
          title: `Credential: ${cred.serviceName}`,
          description: `Username: ${cred.username || 'N/A'}\nURL: ${cred.url || 'N/A'}`,
          category: 'Access',
          content: cred
        });
      }
    }

    // Process contacts - try to map to existing tasks
    for (const contact of analysisResult.contacts || []) {
      const role = contact.role?.toLowerCase() || '';
      const searchTerms = dataTypeToTaskKeywords[role] || [role];
      searchTerms.push(contact.role, contact.name);
      
      const matchingTask = findMatchingTask(searchTerms);
      
      if (matchingTask && existingProject) {
        const valueToSet = `${contact.name}${contact.phone ? ` - ${contact.phone}` : ''}`;
        const notesToAdd = `Company: ${contact.company || 'N/A'}\nEmail: ${contact.email || 'N/A'}\nNotes: ${contact.notes || 'N/A'}`;
        
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({
            field_value: valueToSet,
            notes: matchingTask.notes ? `${matchingTask.notes}\n${notesToAdd}` : notesToAdd,
            status: 'completed',
            completed_date: new Date().toISOString()
          })
          .eq("id", matchingTask.id);
        
        if (!error) {
          tasksUpdated.push(matchingTask.title);
          console.log(`Updated task "${matchingTask.title}" with contact info`);
        }
      } else {
        propertyInfoToStore.push({
          type: 'contact',
          title: `Contact: ${contact.role} - ${contact.name}`,
          description: `Phone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}\nCompany: ${contact.company || 'N/A'}`,
          category: 'Contacts',
          content: contact
        });
      }
    }

    // Process appliances - store as property info
    for (const appliance of analysisResult.appliances || []) {
      propertyInfoToStore.push({
        type: 'appliance',
        title: `Appliance: ${appliance.type}${appliance.brand ? ` - ${appliance.brand}` : ''}`,
        description: `Model: ${appliance.model || 'N/A'}\nSerial: ${appliance.serialNumber || 'N/A'}\nLocation: ${appliance.location || 'N/A'}`,
        category: 'Equipment',
        content: appliance
      });
    }

    // Process property info
    for (const info of analysisResult.propertyInfo || []) {
      propertyInfoToStore.push({
        type: 'property_info',
        title: info.title,
        description: info.items.join("\n• "),
        category: info.category,
        content: info
      });
    }

    // Store all unmapped property info as owner_conversation_actions
    const actionsToInsert = [];
    const isDuplicate = (type: string, title: string) => {
      const key = `${type}:${title.toLowerCase()}`;
      if (existingTitles.has(key)) {
        console.log("Skipping duplicate:", key);
        return true;
      }
      existingTitles.add(key);
      return false;
    };

    for (const info of propertyInfoToStore) {
      if (isDuplicate("property_info", info.title)) continue;
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "property_info",
        title: info.title,
        description: info.description,
        category: info.category,
        priority: "medium",
        content: info.content,
        status: "suggested",
      });
    }

    // Add FAQs as actions
    for (const faq of analysisResult.faqs || []) {
      if (isDuplicate("faq", faq.question)) continue;
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "faq",
        title: faq.question,
        description: faq.answer,
        category: faq.category,
        priority: "medium",
        content: faq,
        status: "suggested",
      });
    }

    // Add setup notes as actions
    for (const note of analysisResult.setupNotes || []) {
      if (isDuplicate("setup_note", note.title)) continue;
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "setup_note",
        title: note.title,
        description: note.description,
        priority: note.priority || "medium",
        content: note,
        status: "suggested",
      });
    }

    // Process AI-detected tasks - try to map to existing tasks first
    for (const task of analysisResult.tasks || []) {
      // Try to find a matching existing task
      let matchedExistingTask = existingTasks.find(t => stringsMatch(t.title, task.title));
      
      if (matchedExistingTask && existingProject) {
        // Update the existing task
        const { error } = await supabase
          .from("onboarding_tasks")
          .update({
            description: task.description || matchedExistingTask.description,
            notes: matchedExistingTask.notes 
              ? `${matchedExistingTask.notes}\n\nFrom analysis: ${task.description || ''}`
              : `From analysis: ${task.description || ''}`,
            status: task.isCompleted ? 'completed' : matchedExistingTask.status,
            completed_date: task.isCompleted ? new Date().toISOString() : matchedExistingTask.completed_date
          })
          .eq("id", matchedExistingTask.id);
        
        if (!error) {
          tasksUpdated.push(matchedExistingTask.title);
          console.log(`Updated existing task "${matchedExistingTask.title}" with new info`);
        }
      } else {
        // Only create as action if no matching task found
        if (isDuplicate("task", task.title)) continue;
        actionsToInsert.push({
          conversation_id: conversationId,
          action_type: "task",
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority || "medium",
          content: task,
          status: task.isCompleted ? "completed" : "suggested",
          assigned_to: task.assignedTo || "peachhaus",
          completed_at: task.isCompleted ? new Date().toISOString() : null,
        });
      }
    }

    if (actionsToInsert.length > 0) {
      const { error: actionsError } = await supabase
        .from("owner_conversation_actions")
        .insert(actionsToInsert);

      if (actionsError) {
        console.error("Failed to insert actions:", actionsError);
      }
    }

    console.log(`Analysis complete. Updated ${tasksUpdated.length} existing tasks, created ${actionsToInsert.length} property info items.`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: analysisResult.summary,
        contentType: analysisResult.contentType,
        tasksUpdated: tasksUpdated.length,
        tasksUpdatedList: tasksUpdated,
        propertyInfoCount: actionsToInsert.filter(a => a.action_type === 'property_info').length,
        faqCount: actionsToInsert.filter(a => a.action_type === 'faq').length,
        setupNotesCount: actionsToInsert.filter(a => a.action_type === 'setup_note').length,
        newTasksCount: actionsToInsert.filter(a => a.action_type === 'task').length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in analyze-owner-conversation:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
