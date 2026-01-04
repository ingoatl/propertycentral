import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HolidayEmailRequest {
  holidayTemplateId: string;
  testEmail?: string;
  ownerIds?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    const resend = new Resend(RESEND_API_KEY);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { holidayTemplateId, testEmail, ownerIds } = await req.json() as HolidayEmailRequest;

    console.log('=== HOLIDAY EMAIL REQUEST ===');
    console.log('Template ID:', holidayTemplateId);
    console.log('Test email:', testEmail || 'None');
    console.log('Owner IDs count:', ownerIds?.length || 'All');

    // Fetch the holiday template
    const { data: template, error: templateError } = await supabase
      .from('holiday_email_templates')
      .select('*')
      .eq('id', holidayTemplateId)
      .single();

    if (templateError || !template) {
      throw new Error(`Holiday template not found: ${templateError?.message}`);
    }

    console.log('Using template:', template.holiday_name);

    // Handle test email with real owner data
    if (testEmail && ownerIds && ownerIds.length > 0) {
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id, name, address, image_path, owner_id,
          property_owners!inner(id, name, email)
        `)
        .in('owner_id', ownerIds)
        .limit(1);

      if (propertiesError || !properties || properties.length === 0) {
        throw new Error(`Failed to fetch owner data: ${propertiesError?.message || 'Owner not found'}`);
      }

      const property = properties[0];
      const owner = property.property_owners as any;

      console.log(`Sending personalized test email for ${owner.name} to ${testEmail}`);

      const result = await sendHolidayEmail({
        supabase,
        resend,
        template,
        owner: { id: owner.id, name: owner.name, email: testEmail },
        property: { id: property.id, name: property.name || property.address, image_path: property.image_path },
        isTest: true,
        supabaseUrl,
      });

      return new Response(
        JSON.stringify({ success: true, message: `Personalized test email sent to ${testEmail}`, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle test email with mock data
    if (testEmail && (!ownerIds || ownerIds.length === 0)) {
      const result = await sendHolidayEmail({
        supabase,
        resend,
        template,
        owner: { id: 'test', name: 'Test Owner', email: testEmail },
        property: { id: 'test', name: 'Sample Property', image_path: null },
        isTest: true,
        supabaseUrl,
      });

      return new Response(
        JSON.stringify({ success: true, message: `Test email sent to ${testEmail}`, result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all property owners with their properties
    let ownersQuery = supabase
      .from('properties')
      .select(`
        id, name, address, image_path, owner_id,
        property_owners!inner(id, name, email, second_owner_name, second_owner_email)
      `)
      .is('offboarded_at', null)
      .not('owner_id', 'is', null);

    if (ownerIds && ownerIds.length > 0) {
      ownersQuery = ownersQuery.in('owner_id', ownerIds);
    }

    const { data: properties, error: propertiesError } = await ownersQuery;

    if (propertiesError) {
      throw new Error(`Failed to fetch properties: ${propertiesError.message}`);
    }

    console.log(`Found ${properties?.length || 0} properties to send emails for`);

    // Fetch pre-generated images from queue
    const { data: queueItems } = await supabase
      .from('holiday_email_queue')
      .select('recipient_email, pre_generated_image_url')
      .eq('template_id', holidayTemplateId)
      .eq('status', 'pending')
      .not('pre_generated_image_url', 'is', null);

    const preGeneratedImageMap = new Map<string, string>();
    queueItems?.forEach((item: { recipient_email: string; pre_generated_image_url: string }) => {
      if (item.pre_generated_image_url) {
        preGeneratedImageMap.set(item.recipient_email, item.pre_generated_image_url);
      }
    });

    console.log(`Found ${preGeneratedImageMap.size} pre-generated images`);

    const results: any[] = [];
    const processedEmails = new Set<string>();

    for (const property of properties || []) {
      const owner = property.property_owners as any;

      if (processedEmails.has(owner.email)) {
        console.log(`Skipping duplicate: ${owner.email}`);
        continue;
      }
      processedEmails.add(owner.email);

      try {
        const result = await sendHolidayEmail({
          supabase,
          resend,
          template,
          owner: { id: owner.id, name: owner.name, email: owner.email },
          property: { id: property.id, name: property.name || property.address, image_path: property.image_path },
          isTest: false,
          supabaseUrl,
          preGeneratedImageUrl: preGeneratedImageMap.get(owner.email),
        });

        results.push({ email: owner.email, success: true, ...result });

        // Send to second owner if exists
        if (owner.second_owner_email && !processedEmails.has(owner.second_owner_email)) {
          processedEmails.add(owner.second_owner_email);
          const secondOwnerName = owner.second_owner_name || owner.name;

          const secondResult = await sendHolidayEmail({
            supabase,
            resend,
            template,
            owner: { id: owner.id, name: secondOwnerName, email: owner.second_owner_email },
            property: { id: property.id, name: property.name || property.address, image_path: property.image_path },
            isTest: false,
            supabaseUrl,
            preGeneratedImageUrl: preGeneratedImageMap.get(owner.second_owner_email),
          });

          results.push({ email: owner.second_owner_email, success: true, ...secondResult });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 150));

      } catch (error) {
        console.error(`Failed to send to ${owner.email}:`, error);
        results.push({
          email: owner.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} emails, ${failCount} failed`,
        totalSent: successCount,
        totalFailed: failCount,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-holiday-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Downloads an image and returns it as base64 for inline embedding
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; contentType: string } | null> {
  try {
    console.log('Downloading image for inline embedding:', imageUrl);
    
    const response = await fetch(imageUrl, {
      headers: { 'Accept': 'image/*' }
    });

    if (!response.ok) {
      console.error('Failed to download image:', response.status, response.statusText);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);

    console.log('Image downloaded successfully, size:', Math.round(uint8Array.length / 1024), 'KB');
    return { base64, contentType };
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

async function sendHolidayEmail({
  supabase,
  resend,
  template,
  owner,
  property,
  isTest,
  supabaseUrl,
  preGeneratedImageUrl,
}: {
  supabase: any;
  resend: any;
  template: any;
  owner: { id: string; name: string; email: string };
  property: { id: string; name: string; image_path: string | null };
  isTest: boolean;
  supabaseUrl: string;
  preGeneratedImageUrl?: string | null;
}) {
  const ownerFirstName = owner.name.split(' ')[0];
  let generatedImageUrl: string | null = null;
  let imageAttachment: { content: string; filename: string; contentId: string } | null = null;

  // Step 1: Get image URL (pre-generated or generate on-the-fly)
  if (preGeneratedImageUrl) {
    console.log(`Using pre-generated image for ${ownerFirstName}`);
    generatedImageUrl = preGeneratedImageUrl;
  } else {
    console.log(`Generating image on-the-fly for ${ownerFirstName} - ${property.name}`);

    try {
      const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-holiday-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          ownerFirstName,
          propertyName: property.name,
          promptTemplate: template.image_prompt_template,
          holidayName: template.holiday_name,
        }),
      });

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        generatedImageUrl = imageData.imageUrl;
        console.log('Image generated successfully:', generatedImageUrl);
      } else {
        console.error('Image generation failed:', await imageResponse.text());
      }
    } catch (error) {
      console.error('Error generating image:', error);
    }
  }

  // Step 2: Download image and convert to base64 for inline embedding (CID)
  // This is the industry best practice - images are embedded directly in the email
  // ensuring they always display regardless of email client settings
  if (generatedImageUrl) {
    const imageData = await downloadImageAsBase64(generatedImageUrl);
    if (imageData) {
      imageAttachment = {
        content: imageData.base64,
        filename: 'holiday-greeting.png',
        contentId: 'holiday-image-cid',
      };
      console.log('Image prepared for inline embedding via CID');
    }
  }

  // Step 3: Personalize message
  let personalizedMessage = template.message_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);

  // Clean up greeting/closing lines
  personalizedMessage = personalizedMessage
    .replace(/^Dear [^,\n]+,?\s*\n*/i, '')
    .trim()
    .replace(/\n*(With warmest wishes|With warm regards|Warmest regards|Warm regards|Warmly|With love|With gratitude|Cheers|Best wishes|Best regards|Sincerely|Regards),?\s*\n+.*(Anja|Ingo|PeachHaus).*$/gis, '')
    .trim();

  const personalizedSubject = template.subject_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);

  // Step 4: Build HTML using CID reference for inline image
  const htmlContent = buildHolidayEmailHtml({
    subject: personalizedSubject,
    message: personalizedMessage,
    ownerFirstName,
    holidayEmoji: template.emoji,
    hasInlineImage: !!imageAttachment,
    externalImageUrl: !imageAttachment ? generatedImageUrl : null,
  });

  // Step 5: Send email with inline attachment
  const emailPayload: any = {
    from: 'PeachHaus Group <info@peachhausgroup.com>',
    to: [owner.email],
    cc: ['anja@peachhausgroup.com'],
    subject: personalizedSubject,
    html: htmlContent,
  };

  // Add inline image attachment if available
  if (imageAttachment) {
    emailPayload.attachments = [{
      content: imageAttachment.content,
      filename: imageAttachment.filename,
      content_id: imageAttachment.contentId,
    }];
    console.log('Sending email with inline CID image attachment');
  }

  const emailResult = await resend.emails.send(emailPayload);
  console.log(`Email sent to ${owner.email}:`, emailResult);

  // Step 6: Log the send
  if (!isTest) {
    await supabase.from('holiday_email_logs').insert({
      owner_id: owner.id,
      property_id: property.id,
      holiday_template_id: template.id,
      recipient_email: owner.email,
      generated_image_url: generatedImageUrl,
      status: 'sent',
    });
  }

  return { emailId: emailResult.id, imageUrl: generatedImageUrl, imageEmbedded: !!imageAttachment };
}

function buildHolidayEmailHtml({
  subject,
  message,
  ownerFirstName,
  holidayEmoji,
  hasInlineImage,
  externalImageUrl,
}: {
  subject: string;
  message: string;
  ownerFirstName: string;
  holidayEmoji: string;
  hasInlineImage: boolean;
  externalImageUrl: string | null;
}) {
  const currentYear = new Date().getFullYear();

  // Hosted image URLs - same signature/headshot as property tab dashboard
  const hostsPhotoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-headshot.png";
  const signatureUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/ingo-signature.png";

  // Use CID reference for inline image (most reliable), fall back to external URL
  let imageHtml = '';
  if (hasInlineImage) {
    // CID (Content-ID) reference - image is embedded in the email itself
    // This is the most reliable method as images are part of the email data
    imageHtml = `
    <tr>
      <td style="padding: 0 32px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
          <tr>
            <td style="border-radius: 8px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);">
              <img src="cid:holiday-image-cid" 
                   alt="Season's Greetings from PeachHaus"
                   width="556"
                   style="width: 100%; max-width: 556px; height: auto; display: block; border-radius: 8px; background-color: #f5f3ef;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
  } else if (externalImageUrl) {
    // Fallback to external URL (less reliable, may be blocked by email clients)
    imageHtml = `
    <tr>
      <td style="padding: 0 32px;">
        <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
          <tr>
            <td style="border-radius: 8px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);">
              <img src="${externalImageUrl}" 
                   alt="Season's Greetings from PeachHaus"
                   width="556"
                   style="width: 100%; max-width: 556px; height: auto; display: block; border-radius: 8px; background-color: #f5f3ef;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Georgia, serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f5f3ef; -webkit-font-smoothing: antialiased;">
  
  <!-- Outer Container -->
  <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        
        <!-- Main Email Card -->
        <table cellpadding="0" cellspacing="0" width="620" style="max-width: 620px; background-color: #ffffff; border-radius: 0; box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
          
          <!-- Elegant Top Border -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
          <!-- Logo Header -->
          <tr>
            <td style="padding: 32px 40px 24px 40px; text-align: center; background-color: #ffffff;">
              <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
                   alt="PeachHaus" 
                   style="height: 44px; width: auto;"
                   onerror="this.style.display='none'">
            </td>
          </tr>
          
          <!-- Holiday Image -->
          ${imageHtml}
          
          <!-- Message Content -->
          <tr>
            <td style="padding: 44px 48px 36px 48px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 28px 0; font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 400; color: #1a1a1a; letter-spacing: 0.5px; line-height: 1.2;">
                Dear ${ownerFirstName},
              </p>
              
              <!-- Message Body -->
              ${message.split('\n\n').map(para => `
              <p style="margin: 0 0 22px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.9; color: #4a4a4a; font-weight: 400; letter-spacing: 0.2px;">
                ${para.replace(/\n/g, '<br>')}
              </p>
              `).join('')}
              
            </td>
          </tr>
          
          <!-- Elegant Divider -->
          <tr>
            <td style="padding: 0 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="border-top: 1px solid #e8e4de;"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature Section -->
          <tr>
            <td style="padding: 36px 48px 16px 48px; text-align: center;">
              <p style="margin: 0 0 16px 0; font-family: Georgia, serif; font-size: 14px; color: #8a8a8a; text-transform: uppercase; letter-spacing: 2px;">
                WARMEST REGARDS
              </p>
              <img src="${signatureUrl}" 
                   alt="Anja & Ingo Schaer" 
                   style="height: 50px; width: auto; margin-bottom: 12px;"
                   onerror="this.style.display='none'">
              <p style="margin: 0 0 4px 0; font-family: Georgia, serif; font-size: 13px; color: #8a8a8a; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                PEACHHAUS GROUP
              </p>
              <p style="margin: 16px 0 0 0; font-family: Georgia, serif; font-size: 12px; color: #8a8a8a;">
                (404) 800-5932 | info@peachhausgroup.com
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 48px 24px 48px;">
              <table cellpadding="0" cellspacing="0" width="100%" align="center">
                <tr>
                  <td align="center">
                    <img src="${hostsPhotoUrl}" 
                         alt="Anja & Ingo" 
                         width="80" 
                         style="width: 80px; height: auto; border-radius: 50%; border: 2px solid #e8e4de;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 48px 32px 48px; background-color: #faf9f7; border-top: 1px solid #e8e4de;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 12px; color: #8a8a8a;">
                      PeachHaus Group · Atlanta, Georgia
                    </p>
                    <p style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 11px; color: #aaa;">
                      © ${currentYear} PeachHaus Group. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
`;
}
