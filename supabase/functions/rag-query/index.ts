import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VectorSearchResult {
  file_id: string;
  filename: string;
  score: number;
  attributes: Record<string, unknown>;
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const vectorStoreId = Deno.env.get('OPENAI_VECTOR_STORE_ID');

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    if (!vectorStoreId) {
      throw new Error('OPENAI_VECTOR_STORE_ID is not configured');
    }

    const { 
      query, 
      max_results = 5, 
      include_citations = true,
      system_context = '',
      conversation_history = []
    } = await req.json();

    if (!query) {
      throw new Error('Query is required');
    }

    console.log(`RAG Query: "${query}"`);

    // Step 1: Search the vector store for relevant chunks
    const searchResponse = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          max_num_results: max_results,
          rewrite_query: true,
          ranking_options: { ranker: "auto" }
        }),
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Vector store search error:', searchResponse.status, errorText);
      throw new Error(`Vector store search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const searchResults: VectorSearchResult[] = (searchData.data || []).map((result: Record<string, unknown>) => ({
      file_id: result.file_id,
      filename: result.filename,
      score: result.score,
      attributes: result.attributes || {},
      content: Array.isArray(result.content) 
        ? result.content.map((c: { text?: string }) => c.text || '').join('\n')
        : '',
    }));

    console.log(`Found ${searchResults.length} relevant chunks`);

    // Step 2: Build context from search results
    let retrievedContext = '';
    const citations: { filename: string; score: number; excerpt: string }[] = [];

    searchResults.forEach((result, index) => {
      if (result.content) {
        retrievedContext += `\n--- Source ${index + 1}: ${result.filename} (Relevance: ${(result.score * 100).toFixed(1)}%) ---\n`;
        retrievedContext += result.content + '\n';
        
        citations.push({
          filename: result.filename,
          score: result.score,
          excerpt: result.content.substring(0, 200) + (result.content.length > 200 ? '...' : '')
        });
      }
    });

    // Step 3: Generate response using LLM with retrieved context
    const systemPrompt = `You are a knowledgeable assistant for Peachhaus Group, a property management company in Atlanta, Georgia.

${system_context ? system_context + '\n\n' : ''}You have access to the company's internal knowledge base containing:
- Cleaning and house rules guides
- HOA bylaws and regulations  
- Property setup documentation
- Operational procedures
- Owner onboarding materials

IMPORTANT INSTRUCTIONS:
1. Answer questions based PRIMARILY on the retrieved context below
2. If the context contains relevant information, use it to provide accurate, specific answers
3. If the context doesn't contain enough information, say so honestly and provide general guidance
4. When citing information, reference the source document name
5. Be professional, helpful, and concise
6. For property-specific questions, always refer to the relevant property documentation

RETRIEVED CONTEXT FROM KNOWLEDGE BASE:
${retrievedContext || 'No relevant documents found for this query.'}

---
Now answer the user's question based on the above context.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation_history.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: query }
    ];

    const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 1500,
      }),
    });

    if (!completionResponse.ok) {
      const errorText = await completionResponse.text();
      console.error('LLM completion error:', completionResponse.status, errorText);
      throw new Error(`LLM completion failed: ${completionResponse.status}`);
    }

    const completionData = await completionResponse.json();
    const generatedResponse = completionData.choices[0]?.message?.content || 'Unable to generate response.';

    console.log('RAG response generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        response: generatedResponse,
        citations: include_citations ? citations : [],
        sources_found: searchResults.length,
        query_used: searchData.search_query || query,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in rag-query:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
