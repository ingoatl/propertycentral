-- Add ical_url column to properties table
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS ical_url text;

-- Update properties with iCal URLs using fuzzy matching
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/9e87632f48de4fd2ba2d385c07a6c899'
WHERE name ILIKE '%boho%luxe%' OR name ILIKE '%boho%atlanta%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/69baa400ada94dedbc40f455aae0f75a'
WHERE name ILIKE '%alpine%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/0a14728d22054698bd005fe5b99d71c5'
WHERE name ILIKE '%house%blues%' OR name ILIKE '%blues%atlanta%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/2cc7e9aa813b46ecaf85fdd80f74e220'
WHERE name ILIKE '%scandi%chic%' OR name ILIKE '%scandichic%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/226e4274326f41318d1ca69ceeef0052'
WHERE name ILIKE '%durham%retreat%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/b66f11246bba4f07bee0200a4b85cecf'
WHERE name ILIKE '%mableton%meadows%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/dd1778d474c040969a6a571c8ca4c920'
WHERE name ILIKE '%bloom%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/41ac72ef00f14ac9880a1d6c79372c11'
WHERE name ILIKE '%old%roswell%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/73a83fd845c04890b7b0a970a43f58d3'
WHERE name ILIKE '%scandi%retreat%' OR name ILIKE '%scandiretreat%';

UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/0e660e65cb994ae09bcc04223c0d2da7'
WHERE name ILIKE '%homerun%hideaway%' OR name ILIKE '%home%run%';

-- Add task template for iCal Feed URL
INSERT INTO public.task_templates (phase_number, task_title, field_type)
VALUES (1, 'iCal Feed URL', 'url')
ON CONFLICT DO NOTHING;