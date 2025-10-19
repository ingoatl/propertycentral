import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'new_question' | 'question_answered';
  question_id: string;
  user_email?: string;
  user_name?: string;
  question_text?: string;
  answer_text?: string;
  property_address?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, question_id, user_email, user_name, question_text, answer_text, property_address }: NotificationRequest = await req.json();

    if (type === 'new_question') {
      // Notify admin about new question
      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: ["ingo@peachhausgroup.com"],
        subject: `New FAQ Question from ${user_name || 'User'}`,
        html: `
          <h2>New FAQ Question Submitted</h2>
          <p><strong>From:</strong> ${user_name || 'Unknown'} (${user_email || 'No email'})</p>
          ${property_address ? `<p><strong>Property:</strong> ${property_address}</p>` : ''}
          <p><strong>Question:</strong></p>
          <p>${question_text}</p>
          <p><a href="${Deno.env.get('VITE_SUPABASE_URL')}/dashboard">View in Admin Dashboard</a></p>
        `,
      });

      console.log("Admin notification sent:", emailResponse);
      return new Response(JSON.stringify(emailResponse), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } else if (type === 'question_answered') {
      // Notify user about answered question
      const emailResponse = await resend.emails.send({
        from: "PeachHaus <onboarding@resend.dev>",
        to: [user_email!],
        subject: "Your Question Has Been Answered",
        html: `
          <h2>Your Question Has Been Answered</h2>
          <p>Hi ${user_name || 'there'},</p>
          <p><strong>Your Question:</strong></p>
          <p>${question_text}</p>
          <p><strong>Answer:</strong></p>
          <p>${answer_text}</p>
          ${property_address ? `<p><strong>Property:</strong> ${property_address}</p>` : ''}
          <p>Thank you for your question!</p>
          <p>Best regards,<br>The PeachHaus Team</p>
        `,
      });

      console.log("User notification sent:", emailResponse);
      return new Response(JSON.stringify(emailResponse), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid notification type" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-faq-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
