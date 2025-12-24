-- Add more follow-up sequences for all stages

-- Call Scheduled reminders
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Call Reminder Sequence', 'call_scheduled', 'Reminders before scheduled discovery call');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Call Reminder Sequence'), 1, 0, 1, 'sms', NULL, 'Hi {{name}}! Just a reminder about our discovery call. Looking forward to chatting! - Anja @ PeachHaus 🍑', '09:00:00');

-- Insurance request reminders
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Insurance Request Reminders', 'insurance_requested', 'Follow-ups for STR insurance documentation');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Insurance Request Reminders'), 1, 1, 0, 'email', 'STR Insurance Documentation Needed', 'Hi {{name}},

We''re almost ready to list your property! The last step is to provide proof of STR insurance.

This protects both you and your guests, and is required before we can go live with bookings.

You can reply to this email with your insurance certificate, or let me know if you need recommendations for STR insurance providers.

Thanks!
Anja', '11:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Insurance Request Reminders'), 2, 4, 0, 'sms', NULL, 'Hey {{name}}, just checking in on the STR insurance. Once we have that, we can start getting your property live! Let me know if you need any help. - Anja', '14:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Insurance Request Reminders'), 3, 10, 0, 'email', 'Insurance reminder - almost there!', 'Hi {{name}},

Just a gentle reminder that we''re waiting on your STR insurance documentation to complete the onboarding process.

If you''re having trouble finding coverage, I''d be happy to share some providers that our other property owners have had success with.

Let me know how I can help!

Best,
Anja', '11:00:00');

-- New Lead welcome sequence  
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('New Lead Welcome', 'new_lead', 'Initial welcome message for new calendar bookings');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'New Lead Welcome'), 1, 0, 0, 'both', 'Welcome to PeachHaus! 🍑', 'Hi {{name}}! This is Anja from PeachHaus Property Management. Thanks for scheduling a discovery call with us! I''m excited to learn about your property at {{property_address}} and discuss how we can help maximize your rental income. Talk soon! 🍑', '10:00:00');

-- Call Attended follow-up
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description) VALUES
('Post-Call Follow-up', 'call_attended', 'Follow-up after discovery call');

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Post-Call Follow-up'), 1, 0, 2, 'email', 'Great chatting with you!', 'Hi {{name}},

It was great speaking with you today about your property at {{property_address}}!

As discussed, here are the next steps:
1. I''ll prepare a custom management proposal
2. Review the proposal at your convenience
3. Let me know if you''d like to move forward

I''ll have everything ready for you shortly. In the meantime, feel free to reach out with any questions!

Best,
Anja
PeachHaus Property Management', '10:00:00'),
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Post-Call Follow-up'), 2, 2, 0, 'sms', NULL, 'Hey {{name}}! Just wanted to check in after our call. Did you have a chance to review everything? Happy to answer any questions! - Anja', '11:00:00');

-- Ops Handoff notification (internal)
INSERT INTO public.lead_follow_up_sequences (name, trigger_stage, description, stop_on_response) VALUES
('Ops Handoff Complete', 'ops_handoff', 'Welcome message after handoff to operations', false);

INSERT INTO public.lead_follow_up_steps (sequence_id, step_number, delay_days, delay_hours, action_type, template_subject, template_content, send_time) VALUES
((SELECT id FROM public.lead_follow_up_sequences WHERE name = 'Ops Handoff Complete'), 1, 0, 0, 'both', 'Welcome to the PeachHaus Family! 🍑', 'Hi {{name}}!

Welcome officially to the PeachHaus family! 🎉

Your property at {{property_address}} has been handed off to our operations team, and we''re now working on getting everything set up for your first guests.

Here''s what happens next:
• Our team will reach out to schedule a property walkthrough
• We''ll set up your listing across all major platforms
• You''ll receive access to your owner dashboard

We''re thrilled to have you on board!

Warmly,
The PeachHaus Team', '10:00:00');