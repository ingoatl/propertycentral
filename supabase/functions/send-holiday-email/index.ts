import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HolidayEmailRequest {
  holidayTemplateId: string;
  testEmail?: string; // If provided, send only to this email
  ownerIds?: string[]; // If provided, send only to these owners
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const resend = new Resend(RESEND_API_KEY);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { holidayTemplateId, testEmail, ownerIds } = await req.json() as HolidayEmailRequest;

    console.log('Holiday email request:', { holidayTemplateId, testEmail, ownerIds: ownerIds?.length });

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

    // If test email WITH ownerIds, use real owner data but send to test email
    if (testEmail && ownerIds && ownerIds.length > 0) {
      // Fetch the real owner and property data
      const { data: properties, error: propertiesError } = await supabase
        .from('properties')
        .select(`
          id,
          name,
          address,
          image_path,
          owner_id,
          property_owners!inner(
            id,
            name,
            email
          )
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
        owner: {
          id: owner.id,
          name: owner.name,
          email: testEmail, // Send to test email, not the owner
        },
        property: {
          id: property.id,
          name: property.name || property.address,
          image_path: property.image_path,
        },
        isTest: true,
        lovableApiKey: LOVABLE_API_KEY,
        supabaseUrl,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Personalized test email for ${owner.name} sent to ${testEmail}`,
          result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If test email only (no ownerIds), create a mock recipient
    if (testEmail && (!ownerIds || ownerIds.length === 0)) {
      const result = await sendHolidayEmail({
        supabase,
        resend,
        template,
        owner: {
          id: 'test',
          name: 'Test Owner',
          email: testEmail,
        },
        property: {
          id: 'test',
          name: 'Sample Property',
          image_path: null,
        },
        isTest: true,
        lovableApiKey: LOVABLE_API_KEY,
        supabaseUrl,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Test email sent to ${testEmail}`,
          result 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all property owners with their properties
    let ownersQuery = supabase
      .from('properties')
      .select(`
        id,
        name,
        address,
        image_path,
        owner_id,
        property_owners!inner(
          id,
          name,
          email,
          second_owner_name,
          second_owner_email
        )
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

    const results: any[] = [];
    const processedEmails = new Set<string>();

    for (const property of properties || []) {
      const owner = property.property_owners as any;
      
      // Skip if we've already sent to this email
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
          owner: {
            id: owner.id,
            name: owner.name,
            email: owner.email,
          },
          property: {
            id: property.id,
            name: property.name || property.address,
            image_path: property.image_path,
          },
          isTest: false,
          lovableApiKey: LOVABLE_API_KEY,
          supabaseUrl,
        });

        results.push({ email: owner.email, success: true, ...result });

        // Also send to second owner if exists
        if (owner.second_owner_email && !processedEmails.has(owner.second_owner_email)) {
          processedEmails.add(owner.second_owner_email);
          
          // Use second owner's name if available, otherwise use primary owner's name
          const secondOwnerName = owner.second_owner_name || owner.name;
          
          const secondResult = await sendHolidayEmail({
            supabase,
            resend,
            template,
            owner: {
              id: owner.id,
              name: secondOwnerName,
              email: owner.second_owner_email,
            },
            property: {
              id: property.id,
              name: property.name || property.address,
              image_path: property.image_path,
            },
            isTest: false,
            lovableApiKey: LOVABLE_API_KEY,
            supabaseUrl,
          });
          
          results.push({ email: owner.second_owner_email, success: true, ...secondResult });
        }

        // Rate limiting: wait 100ms between emails to stay under Resend limits
        await new Promise(resolve => setTimeout(resolve, 100));

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
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function sendHolidayEmail({
  supabase,
  resend,
  template,
  owner,
  property,
  isTest,
  lovableApiKey,
  supabaseUrl,
}: {
  supabase: any;
  resend: any;
  template: any;
  owner: { id: string; name: string; email: string };
  property: { id: string; name: string; image_path: string | null };
  isTest: boolean;
  lovableApiKey: string;
  supabaseUrl: string;
}) {
  const ownerFirstName = owner.name.split(' ')[0];

  console.log(`Generating image for ${ownerFirstName} - ${property.name}`);

  // Generate personalized holiday image
  let generatedImageUrl = null;

  try {
    // Call generate-holiday-image function with proper template
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

  // Personalize the message and remove any greeting lines since we add it in HTML
  let personalizedMessage = template.message_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);
  
  // Remove greeting line if present (e.g., "Dear John," or "Dear John Smith,")
  personalizedMessage = personalizedMessage
    .replace(/^Dear [^,\n]+,?\s*\n*/i, '')
    .trim();

  const personalizedSubject = template.subject_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);

  // Build HTML email
  const htmlContent = buildHolidayEmailHtml({
    subject: personalizedSubject,
    message: personalizedMessage,
    ownerFirstName,
    holidayEmoji: template.emoji,
    imageUrl: generatedImageUrl,
    isTest,
  });

  // Send email via Resend
  const emailResult = await resend.emails.send({
    from: 'PeachHaus Group <info@peachhausgroup.com>',
    to: [owner.email],
    subject: isTest ? `[TEST] ${personalizedSubject}` : personalizedSubject,
    html: htmlContent,
  });

  console.log(`Email sent to ${owner.email}:`, emailResult);

  // Log the send (skip for test)
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

  return { emailId: emailResult.id, imageUrl: generatedImageUrl };
}

function buildHolidayEmailHtml({
  subject,
  message,
  ownerFirstName,
  holidayEmoji,
  imageUrl,
  isTest,
}: {
  subject: string;
  message: string;
  ownerFirstName: string;
  holidayEmoji: string;
  imageUrl: string | null;
  isTest: boolean;
}) {
  // Get current year for footer
  const currentYear = new Date().getFullYear();
  
  // Hosted image URLs - using Supabase storage bucket with actual uploaded filenames
  const hostsPhotoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Gemini_Generated_Image_1rel501rel501rel-2.png";
  const signatureUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Screenshot_41-2.jpg";
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&family=Lato:wght@300;400&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: 'Lato', 'Helvetica Neue', Arial, sans-serif; background-color: #f8f6f3;">
  ${isTest ? `
  <div style="background-color: #fef3c7; padding: 12px; text-align: center; font-family: sans-serif; font-size: 14px; color: #92400e;">
    ⚠️ This is a TEST email - not sent to property owners
  </div>
  ` : ''}
  
  <!-- Outer wrapper with sophisticated styling -->
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 680px; margin: 24px auto; background-color: #ffffff; overflow: hidden; box-shadow: 0 8px 40px rgba(0,0,0,0.06);">
    
    <!-- Refined gold accent top border -->
    <tr>
      <td style="height: 3px; background: linear-gradient(90deg, #c5a47e 0%, #d4b896 50%, #c5a47e 100%);"></td>
    </tr>
    
    <!-- Elegant Header -->
    <tr>
      <td style="padding: 36px 48px 28px 48px; text-align: left; background-color: #1a1a2e;">
        <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
             alt="PeachHaus Group" 
             style="height: 40px; width: auto;"
             onerror="this.style.display='none'">
      </td>
    </tr>
    
    <!-- Holiday Image - Full width, larger display -->
    ${imageUrl ? `
    <tr>
      <td style="padding: 0; background-color: #ffffff;">
        <img src="${imageUrl}" 
             alt="Season's Greetings" 
             style="width: 100%; max-width: 680px; height: auto; display: block;">
      </td>
    </tr>
    ` : ''}
    
    <!-- Message Content - Left aligned with refined typography, starts with greeting -->
    <tr>
      <td style="padding: 36px 48px 40px 48px; color: #4a4a4a; font-size: 15px; line-height: 1.85; text-align: left;">
        <p style="margin: 0 0 24px 0; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; color: #2d2d2d; font-weight: 400; letter-spacing: 0.3px;">
          Dear ${ownerFirstName},
        </p>
        ${message.split('\n\n').map(para => `<p style="margin: 0 0 20px 0; font-weight: 300; letter-spacing: 0.2px;">${para.replace(/\n/g, '<br>')}</p>`).join('')}
      </td>
    </tr>
    
    <!-- Subtle Divider -->
    <tr>
      <td style="padding: 0 48px;">
        <div style="height: 1px; background: linear-gradient(90deg, #d4b896 0%, #e8ddd0 50%, transparent 100%); width: 60%;"></div>
      </td>
    </tr>
    
    <!-- Signature Section with Photo and Handwritten Signature -->
    <tr>
      <td style="padding: 32px 48px 40px 48px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <!-- Hosts Photo -->
            <td style="width: 120px; vertical-align: middle; padding-right: 20px;">
              <img src="${hostsPhotoUrl}" 
                   alt="Anja & Ingo" 
                   style="width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 2px solid #f0ebe4; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
            </td>
            <!-- Signature and closing -->
            <td style="vertical-align: middle; text-align: left;">
              <p style="margin: 0 0 6px 0; color: #7a7a7a; font-size: 11px; font-weight: 400; letter-spacing: 1.5px; text-transform: uppercase;">With Warmest Regards</p>
              <img src="${signatureUrl}" 
                   alt="Anja & Ingo Schaer" 
                   style="height: 48px; width: auto; margin: 6px 0 10px 0;">
              <p style="margin: 0; color: #9a9a9a; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">PeachHaus Group</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer with refined styling -->
    <tr>
      <td style="padding: 28px 48px; background-color: #faf9f7; border-top: 1px solid #f0ebe4;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="text-align: left; padding-bottom: 16px;">
              <span style="display: inline-block; width: 24px; height: 1px; background-color: #d4b896; vertical-align: middle;"></span>
              <span style="display: inline-block; margin: 0 10px; color: #d4b896; font-size: 14px;">${holidayEmoji || '✨'}</span>
              <span style="display: inline-block; width: 24px; height: 1px; background-color: #d4b896; vertical-align: middle;"></span>
            </td>
          </tr>
          <tr>
            <td style="text-align: left;">
              <p style="margin: 0 0 4px 0; color: #9a9a9a; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;">
                Premium Property Management
              </p>
              <p style="margin: 0; color: #b8b8b8; font-size: 10px;">
                info@peachhausgroup.com · peachhausgroup.com
              </p>
              <p style="margin: 16px 0 0 0; color: #d0d0d0; font-size: 9px;">
                © ${currentYear} PeachHaus Group. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Gold accent bottom border -->
    <tr>
      <td style="height: 4px; background: linear-gradient(90deg, #d4a574 0%, #c9a66c 25%, #b8956a 50%, #c9a66c 75%, #d4a574 100%);"></td>
    </tr>
  </table>
</body>
</html>
  `;
}
