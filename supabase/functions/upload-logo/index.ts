import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Fetch the logo from the public folder
    const logoResponse = await fetch("https://9ed06ecd-51b7-4166-a07a-107b37f1e8c1.lovableproject.com/peachhaus-logo.png");
    
    if (!logoResponse.ok) {
      throw new Error("Failed to fetch logo");
    }
    
    const logoBlob = await logoResponse.blob();
    const logoBuffer = await logoBlob.arrayBuffer();
    
    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('property-images')
      .upload('peachhaus-logo.png', logoBuffer, {
        contentType: 'image/png',
        upsert: true
      });
    
    if (error) throw error;
    
    console.log("Logo uploaded successfully:", data);
    
    return new Response(
      JSON.stringify({ success: true, message: "Logo uploaded successfully", path: data.path }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error uploading logo:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
