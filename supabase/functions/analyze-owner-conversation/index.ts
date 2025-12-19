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
    isStructured?: boolean; // true for Excel/CSV data
    structuredData?: any; // parsed Excel/CSV data
  }>;
  propertyContext?: {
    id: string;
    name: string;
    address: string;
  };
}

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

    // Build the content for analysis
    let contentToAnalyze = "";
    let hasStructuredData = false;
    
    if (transcript) {
      contentToAnalyze += `## OWNER CONVERSATION TRANSCRIPT\n\n${transcript}\n\n`;
    }
    
    if (documentContents && documentContents.length > 0) {
      for (const doc of documentContents) {
        if (doc.isStructured && doc.structuredData) {
          hasStructuredData = true;
          contentToAnalyze += `## STRUCTURED DATA FROM: ${doc.fileName}\n\n`;
          contentToAnalyze += `This is parsed Excel/CSV data. Extract all relevant property information:\n\n`;
          contentToAnalyze += JSON.stringify(doc.structuredData, null, 2);
          contentToAnalyze += `\n\n`;
        } else {
          contentToAnalyze += `## DOCUMENT: ${doc.fileName}\n\n${doc.content}\n\n`;
        }
      }
    }

    // Enhanced system prompt that handles both documents and structured data
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
      "phaseNumber": 2,
      "phaseTitle": "Property Setup"
    }
  ]
}

ONLY include tasks for items that genuinely require ACTION (installing something, buying something, fixing something, contacting someone). 
Property information, procedures, and rules should go in propertyInfo, NOT tasks.
Be generous with propertyInfo categories and formatting - make it beautiful and useful.
For Excel/CSV data, be thorough - extract EVERYTHING that could be useful for property management.`;

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
      // Extract JSON from potential markdown code blocks
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

    // Create suggested actions from the analysis
    const actionsToInsert = [];

    // Add property info as actions
    for (const info of analysisResult.propertyInfo || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "property_info",
        title: info.title,
        description: info.items.join("\n• "),
        category: info.category,
        priority: info.importance || "medium",
        content: info,
        status: "suggested",
      });
    }

    // Add credentials as actions
    for (const cred of analysisResult.credentials || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "credential",
        title: cred.serviceName,
        description: `Username: ${cred.username || 'N/A'}\nURL: ${cred.url || 'N/A'}`,
        category: "Access",
        priority: "high",
        content: cred,
        status: "suggested",
      });
    }

    // Add appliances as actions
    for (const appliance of analysisResult.appliances || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "appliance",
        title: `${appliance.type}${appliance.brand ? ` - ${appliance.brand}` : ''}`,
        description: `Model: ${appliance.model || 'N/A'}\nSerial: ${appliance.serialNumber || 'N/A'}\nLocation: ${appliance.location || 'N/A'}`,
        category: "Equipment",
        priority: "medium",
        content: appliance,
        status: "suggested",
      });
    }

    // Add utilities as actions
    for (const utility of analysisResult.utilities || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "utility",
        title: `${utility.type} - ${utility.provider}`,
        description: `Account: ${utility.accountNumber || 'N/A'}\nPhone: ${utility.phone || 'N/A'}`,
        category: "Utilities",
        priority: "medium",
        content: utility,
        status: "suggested",
      });
    }

    // Add contacts as actions
    for (const contact of analysisResult.contacts || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "contact",
        title: `${contact.role} - ${contact.name}`,
        description: `Phone: ${contact.phone || 'N/A'}\nEmail: ${contact.email || 'N/A'}\nCompany: ${contact.company || 'N/A'}`,
        category: "Contacts",
        priority: "medium",
        content: contact,
        status: "suggested",
      });
    }

    // Add FAQs as actions
    for (const faq of analysisResult.faqs || []) {
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

    // Add tasks as actions
    for (const task of analysisResult.tasks || []) {
      actionsToInsert.push({
        conversation_id: conversationId,
        action_type: "task",
        title: task.title,
        description: task.description,
        category: task.category,
        priority: task.priority || "medium",
        content: task,
        status: "suggested",
      });
    }

    if (actionsToInsert.length > 0) {
      const { error: actionsError } = await supabase
        .from("owner_conversation_actions")
        .insert(actionsToInsert);

      if (actionsError) {
        console.error("Failed to insert actions:", actionsError);
      }
    }

    console.log(`Analysis complete. Created ${actionsToInsert.length} suggested actions.`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: analysisResult.summary,
        contentType: analysisResult.contentType,
        actionsCount: actionsToInsert.length,
        propertyInfoCount: analysisResult.propertyInfo?.length || 0,
        credentialsCount: analysisResult.credentials?.length || 0,
        appliancesCount: analysisResult.appliances?.length || 0,
        utilitiesCount: analysisResult.utilities?.length || 0,
        contactsCount: analysisResult.contacts?.length || 0,
        faqCount: analysisResult.faqs?.length || 0,
        setupNotesCount: analysisResult.setupNotes?.length || 0,
        tasksCount: analysisResult.tasks?.length || 0,
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
