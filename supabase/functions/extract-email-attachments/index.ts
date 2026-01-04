import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { refreshGoogleToken } from "../_shared/google-oauth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AttachmentInfo {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { gmailMessageId, expenseId, propertyId } = await req.json();

    if (!gmailMessageId) {
      throw new Error('gmailMessageId is required');
    }

    console.log(`Extracting attachments for message: ${gmailMessageId}`);

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_oauth_tokens')
      .select('*')
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No Gmail connection found');
    }

    let accessToken = tokenData.access_token;

    // Refresh token if expired
    if (new Date(tokenData.expires_at) <= new Date()) {
      console.log('Access token expired, refreshing...');
      const refreshResult = await refreshGoogleToken(tokenData.refresh_token);
      accessToken = refreshResult.accessToken;
      
      await supabase
        .from('gmail_oauth_tokens')
        .update({
          access_token: accessToken,
          expires_at: new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', tokenData.user_id);
    }

    // Fetch the full message with attachments
    const messageResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!messageResponse.ok) {
      const error = await messageResponse.text();
      console.error('Failed to fetch message:', error);
      throw new Error('Failed to fetch email from Gmail');
    }

    const emailData = await messageResponse.json();
    
    // Find attachments in the email
    const attachments: AttachmentInfo[] = [];
    
    function findAttachments(parts: any[]) {
      for (const part of parts) {
        if (part.filename && part.body?.attachmentId) {
          // Filter for relevant file types (PDFs, images)
          const mimeType = part.mimeType || '';
          const filename = part.filename.toLowerCase();
          
          if (
            mimeType.includes('pdf') ||
            mimeType.includes('image') ||
            filename.endsWith('.pdf') ||
            filename.endsWith('.png') ||
            filename.endsWith('.jpg') ||
            filename.endsWith('.jpeg')
          ) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              attachmentId: part.body.attachmentId,
              size: part.body.size,
            });
          }
        }
        if (part.parts) {
          findAttachments(part.parts);
        }
      }
    }

    if (emailData.payload?.parts) {
      findAttachments(emailData.payload.parts);
    }

    if (attachments.length === 0) {
      console.log('No PDF or image attachments found in email');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No attachments found',
          attachmentCount: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${attachments.length} attachments:`, attachments.map(a => a.filename));

    // Download and store each attachment
    const uploadedFiles: { filename: string; path: string }[] = [];
    
    for (const attachment of attachments) {
      try {
        // Download attachment from Gmail
        const attachmentResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailMessageId}/attachments/${attachment.attachmentId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!attachmentResponse.ok) {
          console.error(`Failed to download attachment: ${attachment.filename}`);
          continue;
        }

        const attachmentData = await attachmentResponse.json();
        
        // Decode base64url encoded data
        const base64Data = attachmentData.data
          .replace(/-/g, '+')
          .replace(/_/g, '/');
        
        // Convert base64 to Uint8Array
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Generate unique filename
        const timestamp = Date.now();
        const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `original-receipts/${propertyId || 'unknown'}/${timestamp}_${safeFilename}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('expense-documents')
          .upload(storagePath, bytes, {
            contentType: attachment.mimeType,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Failed to upload ${attachment.filename}:`, uploadError);
          continue;
        }

        console.log(`Uploaded ${attachment.filename} to ${storagePath}`);
        uploadedFiles.push({ filename: attachment.filename, path: storagePath });
      } catch (err) {
        console.error(`Error processing attachment ${attachment.filename}:`, err);
      }
    }

    // Update expense record with the first original receipt
    if (expenseId && uploadedFiles.length > 0) {
      const { error: updateError } = await supabase
        .from('expenses')
        .update({
          original_receipt_path: uploadedFiles[0].path,
          attachment_metadata: {
            attachments: uploadedFiles,
            extractedAt: new Date().toISOString(),
            gmailMessageId,
          },
        })
        .eq('id', expenseId);

      if (updateError) {
        console.error('Failed to update expense with receipt path:', updateError);
      } else {
        console.log(`Updated expense ${expenseId} with original receipt`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        attachmentCount: uploadedFiles.length,
        files: uploadedFiles,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error extracting attachments:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});