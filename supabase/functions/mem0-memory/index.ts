import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEM0_API_KEY = Deno.env.get('MEM0_API_KEY');
const MEM0_BASE_URL = 'https://api.mem0.ai/v1';

interface MemoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AddMemoryRequest {
  action: 'add';
  messages: MemoryMessage[];
  user_id: string;
  metadata?: {
    category?: 'command' | 'cron_schedule' | 'process' | 'preference' | 'general';
    property?: string;
    context?: string;
  };
}

interface SearchMemoryRequest {
  action: 'search';
  query: string;
  user_id: string;
  max_results?: number;
  filters?: {
    category?: string;
  };
}

interface GetMemoryRequest {
  action: 'get';
  user_id: string;
  limit?: number;
}

interface DeleteMemoryRequest {
  action: 'delete';
  memory_id: string;
}

type MemoryRequest = AddMemoryRequest | SearchMemoryRequest | GetMemoryRequest | DeleteMemoryRequest;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!MEM0_API_KEY) {
      throw new Error('MEM0_API_KEY is not configured');
    }

    const request: MemoryRequest = await req.json();
    console.log('Mem0 memory request:', JSON.stringify(request, null, 2));

    let response;

    switch (request.action) {
      case 'add': {
        const addReq = request as AddMemoryRequest;
        
        // Build the request body
        const body: any = {
          messages: addReq.messages,
          user_id: addReq.user_id,
        };

        // Add metadata if provided
        if (addReq.metadata) {
          body.metadata = addReq.metadata;
        }

        console.log('Adding memory:', JSON.stringify(body, null, 2));

        response = await fetch(`${MEM0_BASE_URL}/memories/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${MEM0_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Mem0 add error:', errorText);
          throw new Error(`Failed to add memory: ${errorText}`);
        }

        const addResult = await response.json();
        console.log('Memory added:', JSON.stringify(addResult, null, 2));

        return new Response(JSON.stringify({
          success: true,
          result: addResult,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'search': {
        const searchReq = request as SearchMemoryRequest;

        const searchBody: any = {
          query: searchReq.query,
          user_id: searchReq.user_id,
          limit: searchReq.max_results || 10,
        };

        if (searchReq.filters) {
          searchBody.filters = searchReq.filters;
        }

        console.log('Searching memories:', JSON.stringify(searchBody, null, 2));

        response = await fetch(`${MEM0_BASE_URL}/memories/search/`, {
          method: 'POST',
          headers: {
            'Authorization': `Token ${MEM0_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(searchBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Mem0 search error:', errorText);
          throw new Error(`Failed to search memories: ${errorText}`);
        }

        const searchResult = await response.json();
        console.log('Search results:', JSON.stringify(searchResult, null, 2));

        return new Response(JSON.stringify({
          success: true,
          results: searchResult.results || searchResult,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get': {
        const getReq = request as GetMemoryRequest;

        console.log('Getting all memories for user:', getReq.user_id);

        response = await fetch(`${MEM0_BASE_URL}/memories/?user_id=${encodeURIComponent(getReq.user_id)}&limit=${getReq.limit || 100}`, {
          method: 'GET',
          headers: {
            'Authorization': `Token ${MEM0_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Mem0 get error:', errorText);
          throw new Error(`Failed to get memories: ${errorText}`);
        }

        const getResult = await response.json();
        console.log('Get results:', JSON.stringify(getResult, null, 2));

        return new Response(JSON.stringify({
          success: true,
          memories: getResult.results || getResult,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        const deleteReq = request as DeleteMemoryRequest;

        console.log('Deleting memory:', deleteReq.memory_id);

        response = await fetch(`${MEM0_BASE_URL}/memories/${deleteReq.memory_id}/`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Token ${MEM0_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Mem0 delete error:', errorText);
          throw new Error(`Failed to delete memory: ${errorText}`);
        }

        return new Response(JSON.stringify({
          success: true,
          message: 'Memory deleted successfully',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${(request as any).action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in mem0-memory function:', errorMessage);
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
