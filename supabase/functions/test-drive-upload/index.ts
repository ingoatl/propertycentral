import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { uploadToGoogleDrive, getOrCreateFolder } from "../_shared/google-drive.ts";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Google Drive folder IDs for agreement backup
const COHOSTING_FOLDER_ID = "1gFES5ILUV_SMdjugluwZdm4Q_1OoJh2q";
const FULL_SERVICE_FOLDER_ID = "1zsQtJHcEsk0ls_UJnhEsGCdrGlRUDg20";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting test Google Drive upload...");

    // Create a sample PDF-like content (simple text file as placeholder)
    const testContent = `
SAMPLE CO-HOSTING AGREEMENT
============================

Owner: Ingo Schaer
Property: 123 Test Street, Marietta, GA

This is a sample test document to verify Google Drive upload functionality.

Date: ${new Date().toISOString()}

This document was automatically uploaded by the PeachHaus system.
    `.trim();

    const encoder = new TextEncoder();
    const pdfBytes = encoder.encode(testContent);

    // Refresh Google token - try gmail_oauth_tokens first, then google_calendar_tokens
    console.log("Looking for Google token...");
    let tokenData: any = null;
    
    // First try gmail_oauth_tokens
    const { data: gmailToken } = await supabase
      .from("gmail_oauth_tokens")
      .select("*")
      .limit(1)
      .single();
    
    if (gmailToken) {
      tokenData = gmailToken;
      console.log("Found Gmail OAuth token");
    } else {
      // Fallback to google_calendar_tokens
      const { data: calToken } = await supabase
        .from("google_calendar_tokens")
        .select("*")
        .limit(1)
        .single();
      tokenData = calToken;
      console.log("Found Google Calendar token");
    }

    if (!tokenData) {
      throw new Error("No Google token found. Please connect Google account first.");
    }

    let accessToken = tokenData.access_token;
    const tokenExpiry = new Date(tokenData.expires_at);

    if (tokenExpiry <= new Date()) {
      console.log("Token expired, refreshing...");
      accessToken = await refreshGoogleToken(tokenData.refresh_token, supabase, tokenData.user_id);
    }

    // Use co-hosting folder since this is a "cohosting" contract
    const parentFolderId = COHOSTING_FOLDER_ID;
    
    // Create subfolder: "Ingo - 123 Test Street, Marietta"
    const ownerFirstName = "Ingo";
    const propertyAddress = "123 Test Street, Marietta";
    const subfolderName = `${ownerFirstName} - ${propertyAddress}`;
    
    console.log(`Creating/finding subfolder: ${subfolderName}`);
    const subfolderId = await getOrCreateFolder(accessToken, subfolderName, parentFolderId);
    console.log(`Subfolder ID: ${subfolderId}`);

    // Upload the test document to the subfolder
    const fileName = `Test_Agreement_${new Date().toISOString().split('T')[0]}.txt`;
    console.log(`Uploading file: ${fileName} to folder ${subfolderId}`);
    
    const driveUrl = await uploadToGoogleDrive(
      accessToken,
      pdfBytes,
      fileName,
      "text/plain",
      subfolderId
    );

    console.log("Upload successful! Google Drive URL:", driveUrl);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test document uploaded successfully",
        driveUrl,
        folderName: subfolderName,
        fileName,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in test upload:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
