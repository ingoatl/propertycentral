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

    // Fetch pre-generated images from queue for all recipients
    const { data: queueItems } = await supabase
      .from('holiday_email_queue')
      .select('recipient_email, pre_generated_image_url')
      .eq('template_id', holidayTemplateId)
      .eq('status', 'pending')
      .not('pre_generated_image_url', 'is', null);

    // Create a map of email -> pre-generated image URL
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
          preGeneratedImageUrl: preGeneratedImageMap.get(owner.email),
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
            preGeneratedImageUrl: preGeneratedImageMap.get(owner.second_owner_email),
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
  preGeneratedImageUrl,
}: {
  supabase: any;
  resend: any;
  template: any;
  owner: { id: string; name: string; email: string };
  property: { id: string; name: string; image_path: string | null };
  isTest: boolean;
  lovableApiKey: string;
  supabaseUrl: string;
  preGeneratedImageUrl?: string | null;
}) {
  const ownerFirstName = owner.name.split(' ')[0];

  // Use pre-generated image if available, otherwise generate on-the-fly
  let generatedImageUrl: string | null = null;

  if (preGeneratedImageUrl) {
    console.log(`Using pre-generated image for ${ownerFirstName} - ${property.name}`);
    generatedImageUrl = preGeneratedImageUrl;
  } else {
    console.log(`Generating image on-the-fly for ${ownerFirstName} - ${property.name}`);

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
  }

  // Personalize the message and remove any greeting/closing lines since we add them in HTML
  let personalizedMessage = template.message_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);
  
  // Remove greeting line if present (e.g., "Dear John," or "Dear John Smith,")
  personalizedMessage = personalizedMessage
    .replace(/^Dear [^,\n]+,?\s*\n*/i, '')
    .trim();
  
  // Remove closing/sign-off lines since we have a signature section
  // This handles variations like "With warmest wishes,", "Warmly,", "With love,", etc.
  personalizedMessage = personalizedMessage
    .replace(/\n*(With warmest wishes|With warm regards|Warmest regards|Warm regards|Warmly|With love|With gratitude|Cheers|Best wishes|Best regards|Sincerely|Regards),?\s*\n+.*(Anja|Ingo|PeachHaus).*$/gis, '')
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
  });

  // Send email via Resend - CC anja@peachhausgroup.com on all emails
  const emailResult = await resend.emails.send({
    from: 'PeachHaus Group <info@peachhausgroup.com>',
    to: [owner.email],
    cc: ['anja@peachhausgroup.com'],
    subject: personalizedSubject,
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
}: {
  subject: string;
  message: string;
  ownerFirstName: string;
  holidayEmoji: string;
  imageUrl: string | null;
}) {
  // Get current year for footer
  const currentYear = new Date().getFullYear();
  
  // Hosted image URLs - using exact filenames from storage bucket
  const hostsPhotoUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Gemini_Generated_Image_1rel501rel501rel.png";
  const signatureUrl = "https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/Screenshot_41.jpg";
  
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
          
          <!-- Holiday Image - Optimized for instant display -->
          ${imageUrl ? `
          <tr>
            <td style="padding: 0 32px;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f3ef;">
                <tr>
                  <td style="border-radius: 8px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.08);">
                    <img src="${imageUrl}" 
                         alt="Season's Greetings from PeachHaus"
                         width="556"
                         height="371"
                         style="width: 100%; max-width: 556px; height: auto; display: block; border-radius: 8px; background-color: #f5f3ef;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
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
                  <td style="height: 1px; background: linear-gradient(90deg, transparent 0%, #d4b896 20%, #d4b896 80%, transparent 100%);"></td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Signature Section -->
          <tr>
            <td style="padding: 36px 48px 44px 48px;">
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <!-- Hosts Photo -->
                  <td style="width: 100px; vertical-align: top; padding-right: 24px;">
                    <img src="${hostsPhotoUrl}" 
                         alt="Anja & Ingo" 
                         style="width: 90px; height: 90px; border-radius: 50%; object-fit: cover; border: 3px solid #f5f3ef; box-shadow: 0 4px 12px rgba(0,0,0,0.06);">
                  </td>
                  <!-- Signature Area -->
                  <td style="vertical-align: middle;">
                    <p style="margin: 0 0 8px 0; font-family: 'Cormorant Garamond', Georgia, serif; font-size: 13px; color: #8a8a8a; letter-spacing: 2px; text-transform: uppercase; font-weight: 500;">
                      Warmest Regards
                    </p>
                    <img src="${signatureUrl}" 
                         alt="Anja & Ingo" 
                         style="height: 52px; width: auto; margin: 4px 0 8px 0; display: block;">
                    <p style="margin: 0; font-family: Georgia, serif; font-size: 11px; color: #b8956a; letter-spacing: 2px; text-transform: uppercase;">
                      PeachHaus Group
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 0;">
              <table cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf9f7; border-top: 1px solid #eee9e2;">
                <tr>
                  <td style="padding: 28px 48px 24px 48px; text-align: center;">
                    <!-- Decorative Element -->
                    <table cellpadding="0" cellspacing="0" style="margin: 0 auto 18px auto;">
                      <tr>
                        <td style="width: 40px; height: 1px; background-color: #d4b896;"></td>
                        <td style="padding: 0 14px; font-size: 16px; color: #d4b896; line-height: 1;">${holidayEmoji || '✨'}</td>
                        <td style="width: 40px; height: 1px; background-color: #d4b896;"></td>
                      </tr>
                    </table>
                    
                    <p style="margin: 0 0 6px 0; font-family: Georgia, serif; font-size: 11px; color: #9a9a9a; letter-spacing: 1.5px; text-transform: uppercase;">
                      Premium Property Management
                    </p>
                    <p style="margin: 0 0 16px 0; font-family: Georgia, serif; font-size: 12px; color: #b8b8b8;">
                      info@peachhausgroup.com
                    </p>
                    <p style="margin: 0; font-family: Georgia, serif; font-size: 10px; color: #d0d0d0;">
                      © ${currentYear} PeachHaus Group. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Bottom Gold Accent -->
          <tr>
            <td style="height: 4px; background: linear-gradient(90deg, #b8956a 0%, #d4b896 50%, #b8956a 100%);"></td>
          </tr>
          
        </table>
        <!-- End Main Card -->
        
      </td>
    </tr>
  </table>
  
</body>
</html>
  `;
}
