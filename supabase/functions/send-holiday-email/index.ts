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

    // If test email, create a mock recipient
    if (testEmail) {
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
          
          const secondResult = await sendHolidayEmail({
            supabase,
            resend,
            template,
            owner: {
              id: owner.id,
              name: owner.name,
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
  let base64Image = null;

  try {
    // Build property image URL if available
    let propertyImageUrl = null;
    if (property.image_path) {
      if (property.image_path.startsWith('http')) {
        propertyImageUrl = property.image_path;
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('property-images')
          .getPublicUrl(property.image_path);
        propertyImageUrl = publicUrl;
      }
    }

    // Call generate-holiday-image function
    const imageResponse = await fetch(`${supabaseUrl}/functions/v1/generate-holiday-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        propertyImageUrl,
        ownerFirstName,
        propertyName: property.name,
        promptTemplate: template.image_prompt_template,
      }),
    });

    if (imageResponse.ok) {
      const imageData = await imageResponse.json();
      generatedImageUrl = imageData.imageUrl;
      base64Image = imageData.base64Image;
      console.log('Image generated successfully');
    } else {
      console.error('Image generation failed:', await imageResponse.text());
    }
  } catch (error) {
    console.error('Error generating image:', error);
  }

  // Personalize the message
  const personalizedMessage = template.message_template
    .replace(/{owner_name}/g, owner.name)
    .replace(/{owner_first_name}/g, ownerFirstName)
    .replace(/{property_name}/g, property.name);

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
    base64Image,
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
  base64Image,
  isTest,
}: {
  subject: string;
  message: string;
  ownerFirstName: string;
  holidayEmoji: string;
  imageUrl: string | null;
  base64Image: string | null;
  isTest: boolean;
}) {
  const imageSource = base64Image || imageUrl || '';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Georgia', 'Times New Roman', serif; background-color: #f8f5f0;">
  ${isTest ? `
  <div style="background-color: #fef3c7; padding: 12px; text-align: center; font-family: sans-serif; font-size: 14px; color: #92400e;">
    ⚠️ This is a TEST email - not sent to property owners
  </div>
  ` : ''}
  
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <!-- Header with Logo -->
    <tr>
      <td style="padding: 30px 40px; text-align: center; background: linear-gradient(135deg, #2d3748 0%, #1a202c 100%);">
        <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo.png" 
             alt="PeachHaus Group" 
             style="height: 50px; width: auto;"
             onerror="this.style.display='none'">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px; font-weight: normal;">
          ${holidayEmoji || '🎉'} PeachHaus Group
        </h1>
      </td>
    </tr>
    
    <!-- Holiday Image -->
    ${imageSource ? `
    <tr>
      <td style="padding: 0;">
        <img src="${imageSource}" 
             alt="Holiday Greeting" 
             style="width: 100%; height: auto; display: block;"
             onerror="this.style.display='none'">
      </td>
    </tr>
    ` : ''}
    
    <!-- Message Content -->
    <tr>
      <td style="padding: 40px; color: #2d3748; font-size: 16px; line-height: 1.8;">
        ${message.split('\n\n').map(para => `<p style="margin: 0 0 20px 0;">${para.replace(/\n/g, '<br>')}</p>`).join('')}
      </td>
    </tr>
    
    <!-- Signature -->
    <tr>
      <td style="padding: 0 40px 40px 40px;">
        <table cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
              <p style="margin: 0; color: #4a5568; font-size: 14px;">Warmly,</p>
              <p style="margin: 5px 0; color: #2d3748; font-size: 18px; font-weight: bold;">Anja & Ingo</p>
              <p style="margin: 0; color: #718096; font-size: 14px;">PeachHaus Group</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="padding: 30px 40px; background-color: #f7fafc; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0 0 10px 0; color: #718096; font-size: 12px;">
          PeachHaus Group | Premium Property Management
        </p>
        <p style="margin: 0; color: #a0aec0; font-size: 11px;">
          📧 info@peachhausgroup.com | 🌐 peachhausgroup.com
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
