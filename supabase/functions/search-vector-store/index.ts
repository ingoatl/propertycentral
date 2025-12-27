import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    const { query, max_num_results = 10, rewrite_query = true, filters } = await req.json();

    if (!query) {
      throw new Error('Query is required');
    }

    console.log(`Searching vector store for: "${query}"`);
    console.log(`Max results: ${max_num_results}, Rewrite query: ${rewrite_query}`);

    const requestBody: Record<string, unknown> = {
      query,
      max_num_results: Math.min(Math.max(1, max_num_results), 50),
      rewrite_query,
      ranking_options: {
        ranker: "auto"
      }
    };

    if (filters) {
      requestBody.filters = filters;
    }

    const response = await fetch(
      `https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vector store search error:', response.status, errorText);
      throw new Error(`Vector store search failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log(`Found ${data.data?.length || 0} results`);

    // Transform the response for easier consumption
    const results = (data.data || []).map((result: Record<string, unknown>) => ({
      file_id: result.file_id,
      filename: result.filename,
      score: result.score,
      attributes: result.attributes || {},
      content: Array.isArray(result.content) 
        ? result.content.map((c: { text?: string }) => c.text || '').join('\n')
        : '',
    }));

    return new Response(
      JSON.stringify({
        success: true,
        search_query: data.search_query || query,
        results,
        has_more: data.has_more || false,
        result_count: results.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in search-vector-store:', error);
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
