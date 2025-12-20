-- Create holiday email templates table
CREATE TABLE public.holiday_email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  subject_template TEXT NOT NULL,
  message_template TEXT NOT NULL,
  image_prompt_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  recurring BOOLEAN NOT NULL DEFAULT true,
  emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create holiday email logs table
CREATE TABLE public.holiday_email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.property_owners(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  holiday_template_id UUID REFERENCES public.holiday_email_templates(id) ON DELETE SET NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  generated_image_url TEXT,
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.holiday_email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_email_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for holiday_email_templates
CREATE POLICY "Admins can manage holiday templates"
ON public.holiday_email_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view holiday templates"
ON public.holiday_email_templates
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- RLS policies for holiday_email_logs
CREATE POLICY "Admins can manage holiday email logs"
ON public.holiday_email_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view holiday email logs"
ON public.holiday_email_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = auth.uid() AND profiles.status = 'approved'::account_status
));

-- Create storage bucket for holiday images
INSERT INTO storage.buckets (id, name, public) VALUES ('holiday-images', 'holiday-images', true);

-- Storage policies for holiday-images bucket
CREATE POLICY "Anyone can view holiday images"
ON storage.objects FOR SELECT
USING (bucket_id = 'holiday-images');

CREATE POLICY "Admins can upload holiday images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'holiday-images' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete holiday images"
ON storage.objects FOR DELETE
USING (bucket_id = 'holiday-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Seed holiday templates for 2025 and beyond
INSERT INTO public.holiday_email_templates (holiday_name, holiday_date, subject_template, message_template, image_prompt_template, emoji, is_active, recurring) VALUES
('Christmas', '2025-12-24', 'Merry Christmas from PeachHaus Group! 🎄', 
'Dear {owner_name},

Wishing you and your loved ones a magical Christmas filled with warmth, joy, and cherished moments with family and friends.

We are so grateful for the opportunity to partner with you at {property_name}. Your trust in us means the world, and we look forward to continuing to serve you in the coming year.

May your holidays be as wonderful as the home you''ve entrusted to us!

With warmest wishes,
Anja & Ingo
PeachHaus Group',
'Create a stunning Christmas holiday greeting card. Take this property photo and transform it into a magical winter wonderland scene: gentle snow falling, warm golden light glowing from windows, elegant Christmas lights twinkling on the roofline and trees, a beautiful wreath on the door. Add subtle festive touches like a decorated Christmas tree visible through a window. Include elegant script text saying "Happy Holidays, {owner_first_name}!" at the top. Style: Warm, inviting, photorealistic with magical holiday touches. The property should be the hero of the image. Add subtle PeachHaus branding in the corner.', '🎄', true, true),

('New Year', '2025-12-31', 'Happy New Year 2026 from PeachHaus Group! 🎆',
'Dear {owner_name},

As we welcome 2026, we want to express our heartfelt gratitude for your partnership with PeachHaus Group.

The past year has been wonderful, and we''re excited about all the possibilities the new year will bring for {property_name}.

Cheers to new beginnings, continued success, and another amazing year together!

Warmly,
Anja & Ingo
PeachHaus Group',
'Create a celebratory New Year greeting card. Transform this property photo into a midnight celebration scene: dark evening sky with colorful fireworks bursting above the property, champagne sparkle effects, elegant "Happy 2026!" text in gold script at the top with "{owner_first_name}" personalization. Add subtle party elements like confetti. Style: Festive, elegant, magical. The property should glow warmly against the night sky. Add subtle PeachHaus branding.', '🎆', true, true),

('Valentine''s Day', '2025-02-14', 'Happy Valentine''s Day from PeachHaus Group! ❤️',
'Dear {owner_name},

On this day of love, we wanted to take a moment to say how much we appreciate you!

Your property {property_name} holds a special place in our hearts, and we''re so thankful for the trust you''ve placed in us.

Wishing you a day filled with love, warmth, and happiness!

With love,
Anja & Ingo
PeachHaus Group',
'Create a romantic Valentine''s Day greeting card. Transform this property photo with soft pink and red romantic lighting, floating hearts in the sky, rose petals gently scattered, warm candlelit glow from windows. Add elegant script text "Happy Valentine''s Day, {owner_first_name}!" Style: Romantic, warm, dreamy. Soft focus edges with the property as the centerpiece. Add subtle PeachHaus branding.', '❤️', true, true),

('Easter', '2025-04-20', 'Happy Easter from PeachHaus Group! 🐰',
'Dear {owner_name},

Wishing you a joyful Easter filled with new beginnings, spring flowers, and quality time with loved ones!

Just as spring brings renewal, we look forward to another wonderful season of caring for {property_name}.

Hoppy Easter!

Warmly,
Anja & Ingo
PeachHaus Group',
'Create a beautiful Easter spring greeting card. Transform this property photo with a lovely spring garden scene: blooming flowers (tulips, daffodils) in the yard, pastel colors (soft pink, lavender, mint green), gentle spring sunshine, perhaps a few cute Easter eggs hidden in the garden. Add elegant text "Happy Easter, {owner_first_name}!" Style: Fresh, springtime, joyful. The property should look like a charming spring retreat. Add subtle PeachHaus branding.', '🐰', true, true),

('4th of July', '2025-07-04', 'Happy Independence Day from PeachHaus Group! 🇺🇸',
'Dear {owner_name},

Happy 4th of July! 

We hope you''re celebrating with family, friends, and all the fireworks, barbecues, and festivities that make this day special.

We''re proud to be your partners at {property_name} and grateful for the freedom that allows us to build these wonderful relationships.

Have a fantastic Independence Day!

Anja & Ingo
PeachHaus Group',
'Create a patriotic 4th of July greeting card. Transform this property photo with festive Americana decor: red, white, and blue bunting on the porch, American flags, evening sky with spectacular fireworks bursting above, warm BBQ glow in the backyard. Add bold text "Happy 4th of July, {owner_first_name}!" in patriotic colors. Style: Festive, patriotic, summer celebration. The property should be the proud centerpiece of an American celebration. Add subtle PeachHaus branding.', '🇺🇸', true, true),

('Halloween', '2025-10-31', 'Happy Halloween from PeachHaus Group! 🎃',
'Dear {owner_name},

Wishing you a spook-tacular Halloween! 🎃

May your {property_name} be filled with treats (no tricks!) and all the fun of the season.

Have a hauntingly good time!

Anja & Ingo
PeachHaus Group',
'Create a fun Halloween greeting card. Transform this property photo with tasteful spooky decorations: carved jack-o-lanterns glowing on the porch, purple and orange atmospheric lighting, full moon in the background, maybe some friendly bats in the sky, autumn leaves scattered about. Add playful text "Happy Halloween, {owner_first_name}!" in spooky but friendly font. Style: Fun-spooky (not scary), festive autumn atmosphere. The property should look like a charming haunted house you''d want to visit. Add subtle PeachHaus branding.', '🎃', true, true),

('Thanksgiving', '2025-11-27', 'Happy Thanksgiving from PeachHaus Group! 🦃',
'Dear {owner_name},

This Thanksgiving, we want to express our deep gratitude for you!

Your trust in us to care for {property_name} is something we never take for granted. We''re thankful every day for partners like you.

May your Thanksgiving be filled with good food, great company, and countless blessings!

With gratitude,
Anja & Ingo
PeachHaus Group',
'Create a warm Thanksgiving greeting card. Transform this property photo with beautiful autumn harvest decor: golden and orange fall leaves on trees and ground, pumpkins and gourds on the porch, warm golden hour lighting, maybe a cornucopia visible. Add elegant text "Happy Thanksgiving, {owner_first_name}!" in warm autumn colors. Style: Cozy, warm, harvest celebration. The property should look like the perfect place for a Thanksgiving gathering. Add subtle PeachHaus branding.', '🦃', true, true),

('St. Patrick''s Day', '2025-03-17', 'Happy St. Patrick''s Day from PeachHaus Group! 🍀',
'Dear {owner_name},

May the luck of the Irish be with you today and always! 🍀

We consider ourselves incredibly lucky to partner with you at {property_name}.

Sláinte!

Anja & Ingo
PeachHaus Group',
'Create a festive St. Patrick''s Day greeting card. Transform this property photo with Irish celebration touches: shamrocks and four-leaf clovers scattered about, green accent lighting, maybe a rainbow in the sky leading to the property (pot of gold!), green wreaths or decorations. Add playful text "Lucky to know you, {owner_first_name}!" in green and gold. Style: Lucky, cheerful, Irish celebration. The property should look like the end of the rainbow. Add subtle PeachHaus branding.', '🍀', true, true);