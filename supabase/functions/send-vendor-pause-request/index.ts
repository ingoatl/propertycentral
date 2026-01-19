import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PauseRequestPayload {
  vendorId: string;
  propertyId: string;
  assignmentId?: string;
  requestType: 'pause' | 'resume' | 'cancel';
  pauseStartDate?: string;
  pauseEndDate?: string;
  reason?: string;
}

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const generateReferenceNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SVC-${year}${month}-${random}`;
};

const getRequestTypeLabel = (type: string): string => {
  switch (type) {
    case 'pause': return 'Service Pause';
    case 'resume': return 'Service Resume';
    case 'cancel': return 'Service Cancellation';
    default: return 'Service Modification';
  }
};

const handler = async (req: Request): Promise<Response> => {
  console.log("send-vendor-pause-request function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: PauseRequestPayload = await req.json();
    console.log("Payload received:", payload);

    const { vendorId, propertyId, assignmentId, requestType, pauseStartDate, pauseEndDate, reason } = payload;

    if (!vendorId || !propertyId || !requestType) {
      throw new Error("Missing required fields: vendorId, propertyId, requestType");
    }

    // Fetch vendor details
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', vendorId)
      .single();

    if (vendorError || !vendor) {
      throw new Error(`Vendor not found: ${vendorError?.message}`);
    }

    if (!vendor.email) {
      throw new Error("Vendor does not have an email address configured");
    }

    // Fetch property details
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError || !property) {
      throw new Error(`Property not found: ${propertyError?.message}`);
    }

    // Fetch assignment details if provided
    let assignment = null;
    if (assignmentId) {
      const { data: assignmentData } = await supabase
        .from('property_vendor_assignments')
        .select('*')
        .eq('id', assignmentId)
        .single();
      assignment = assignmentData;
    }

    const referenceNumber = generateReferenceNumber();
    const requestTypeLabel = getRequestTypeLabel(requestType);
    const specialty = assignment?.specialty || vendor.specialty?.[0] || 'Service';
    const monthlyCost = assignment?.monthly_cost ? `$${assignment.monthly_cost}/month` : 'As per agreement';

    // Format property address
    const propertyAddress = [
      property.address,
      property.city,
      property.state,
      property.zip_code
    ].filter(Boolean).join(', ');

    // Build the email HTML matching owner statement style
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Modification Request - ${referenceNumber}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #E8927C 0%, #d4745f 100%); padding: 30px 40px; text-align: center;">
              <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-logo-white.png" alt="PeachHaus" style="height: 50px; margin-bottom: 15px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px;">SERVICE MODIFICATION REQUEST</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">Reference: ${referenceNumber}</p>
            </td>
          </tr>
          
          <!-- Property & Service Info -->
          <tr>
            <td style="padding: 30px 40px; background-color: #faf8f7;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e0dc;">
                    <span style="color: #8b7355; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Property</span>
                    <p style="color: #2d2d2d; font-size: 16px; margin: 5px 0 0 0; font-weight: 500;">${propertyAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e8e0dc;">
                    <span style="color: #8b7355; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Service Type</span>
                    <p style="color: #2d2d2d; font-size: 16px; margin: 5px 0 0 0; font-weight: 500;">${specialty.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="color: #8b7355; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Current Cost</span>
                    <p style="color: #2d2d2d; font-size: 16px; margin: 5px 0 0 0; font-weight: 500;">${monthlyCost}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 30px 40px 20px 40px;">
              <p style="color: #2d2d2d; font-size: 16px; line-height: 1.6; margin: 0;">
                Dear ${vendor.name || 'Valued Partner'},
              </p>
              <p style="color: #4a4a4a; font-size: 15px; line-height: 1.6; margin: 15px 0 0 0;">
                We are writing to request a ${requestType === 'cancel' ? 'service cancellation' : requestType === 'resume' ? 'service resumption' : 'temporary service pause'} for the property listed above. Please find the details below.
              </p>
            </td>
          </tr>
          
          <!-- Request Details -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #faf8f7; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: #E8927C; padding: 12px 20px;">
                    <h2 style="color: #ffffff; margin: 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Request Details</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e8e0dc;">
                          <span style="color: #8b7355; font-size: 13px;">Request Type</span>
                          <p style="color: #2d2d2d; font-size: 15px; margin: 5px 0 0 0; font-weight: 600;">${requestTypeLabel}</p>
                        </td>
                      </tr>
                      ${pauseStartDate ? `
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e8e0dc;">
                          <span style="color: #8b7355; font-size: 13px;">${requestType === 'resume' ? 'Resume Date' : 'Pause Start Date'}</span>
                          <p style="color: #2d2d2d; font-size: 15px; margin: 5px 0 0 0; font-weight: 500;">${formatDate(pauseStartDate)}</p>
                        </td>
                      </tr>
                      ` : ''}
                      ${pauseEndDate && requestType === 'pause' ? `
                      <tr>
                        <td style="padding: 10px 0; border-bottom: 1px solid #e8e0dc;">
                          <span style="color: #8b7355; font-size: 13px;">Pause End Date</span>
                          <p style="color: #2d2d2d; font-size: 15px; margin: 5px 0 0 0; font-weight: 500;">${formatDate(pauseEndDate)}</p>
                        </td>
                      </tr>
                      ` : ''}
                      ${reason ? `
                      <tr>
                        <td style="padding: 10px 0;">
                          <span style="color: #8b7355; font-size: 13px;">Reason</span>
                          <p style="color: #2d2d2d; font-size: 15px; margin: 5px 0 0 0;">${reason}</p>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Confirmation Request -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #fff8e6; border-left: 4px solid #f5a623; padding: 20px; border-radius: 0 8px 8px 0;">
                <p style="color: #2d2d2d; font-size: 15px; line-height: 1.6; margin: 0;">
                  <strong>Action Required:</strong> Please confirm this service modification request by replying to this email or calling us at <strong>(404) 800-5932</strong>.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Signature -->
          <tr>
            <td style="padding: 20px 40px 40px 40px; border-top: 1px solid #e8e0dc;">
              <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                Thank you for your continued partnership.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 15px; border-right: 2px solid #E8927C;">
                    <img src="https://ijsxcaaqphaciaenlegl.supabase.co/storage/v1/object/public/property-images/peachhaus-icon.png" alt="PeachHaus" style="width: 50px; height: 50px;">
                  </td>
                  <td style="padding-left: 15px;">
                    <p style="color: #2d2d2d; font-size: 14px; font-weight: 600; margin: 0;">INGO SCHAER</p>
                    <p style="color: #8b7355; font-size: 12px; margin: 3px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Co-Founder, Operations</p>
                    <p style="color: #8b7355; font-size: 12px; margin: 3px 0 0 0;">PeachHaus Group LLC</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin-top: 15px;">
                <tr>
                  <td style="padding-right: 20px;">
                    <span style="color: #8b7355; font-size: 12px;">📧</span>
                    <a href="mailto:ingo@peachhausgroup.com" style="color: #E8927C; font-size: 12px; text-decoration: none;">ingo@peachhausgroup.com</a>
                  </td>
                  <td style="padding-right: 20px;">
                    <span style="color: #8b7355; font-size: 12px;">📞</span>
                    <a href="tel:+14048005932" style="color: #E8927C; font-size: 12px; text-decoration: none;">(404) 800-5932</a>
                  </td>
                  <td>
                    <span style="color: #8b7355; font-size: 12px;">🌐</span>
                    <a href="https://www.peachhausgroup.com" style="color: #E8927C; font-size: 12px; text-decoration: none;">peachhausgroup.com</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #2d2d2d; padding: 20px 40px; text-align: center;">
              <p style="color: #999999; font-size: 11px; margin: 0;">
                © ${new Date().getFullYear()} PeachHaus Group LLC. All rights reserved.
              </p>
              <p style="color: #666666; font-size: 11px; margin: 10px 0 0 0;">
                This is an automated service request from PeachHaus Property Management.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email using Resend API directly
    console.log(`Sending pause request email to ${vendor.email}`);
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "PeachHaus Property Management <statements@peachhausgroup.com>",
        to: [vendor.email],
        cc: ["info@peachhausgroup.com"],
        subject: `Service Modification Request - ${propertyAddress} - Ref: ${referenceNumber}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    
    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(`Failed to send email: ${emailResult.message || 'Unknown error'}`);
    }

    console.log("Email sent successfully:", emailResult);

    // Create the service request record
    const { data: requestRecord, error: insertError } = await supabase
      .from('vendor_service_requests')
      .insert({
        vendor_id: vendorId,
        property_id: propertyId,
        assignment_id: assignmentId || null,
        request_type: requestType,
        status: 'pending',
        pause_start_date: pauseStartDate || null,
        pause_end_date: pauseEndDate || null,
        reason: reason || null,
        reference_number: referenceNumber,
        email_sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating request record:", insertError);
      // Don't throw - email was sent successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        referenceNumber,
        requestId: requestRecord?.id,
        emailId: emailResult?.data?.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-vendor-pause-request:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
