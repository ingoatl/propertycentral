-- Update properties with iCal URLs using better fuzzy matching (address-based)

-- Boho Luxe Atlanta - 14 Villa Ct SE, Smyrna
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/9e87632f48de4fd2ba2d385c07a6c899'
WHERE address ILIKE '%14 Villa Ct%Smyrna%' OR id = 'a67b0195-72ae-463b-9e39-66fa95cf9ab5';

-- The Alpine - Duluth (already mapped correctly)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/69baa400ada94dedbc40f455aae0f75a'
WHERE address ILIKE '%Duluth%' OR name ILIKE '%alpine%';

-- House of Blues Atlanta - Check if exists, may need address
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/0a14728d22054698bd005fe5b99d71c5'
WHERE name ILIKE '%house%blues%' OR name ILIKE '%lavish%living%' OR address ILIKE '%Rita Way%Smyrna%';

-- Scandi-Chic - Kennesaw (already mapped correctly)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/2cc7e9aa813b46ecaf85fdd80f74e220'
WHERE address ILIKE '%Kennesaw%' OR name ILIKE '%scandi%chic%';

-- Durham Retreat - Lilburn
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/226e4274326f41318d1ca69ceeef0052'
WHERE address ILIKE '%Lilburn%' OR name ILIKE '%family%retreat%' OR name ILIKE '%durham%';

-- Mableton Meadows - Mableton
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/b66f11246bba4f07bee0200a4b85cecf'
WHERE address ILIKE '%Mableton%' OR name ILIKE '%woodland%';

-- The Bloom - Roswell (Old Roswell Rd)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/dd1778d474c040969a6a571c8ca4c920'
WHERE address ILIKE '%Old Roswell%Roswell%' OR (address ILIKE '%Roswell%' AND name ILIKE '%luxurious%');

-- Old Roswell - Smyrna (15 Villa Ct)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/41ac72ef00f14ac9880a1d6c79372c11'
WHERE address ILIKE '%15 Villa Ct%Smyrna%' OR id = 'a439a2d4-1f0f-4235-b4c1-88651f3b8bb1';

-- Scandi-Retreat - Smyrna (Laurel Bridge Dr) (already mapped correctly)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/73a83fd845c04890b7b0a970a43f58d3'
WHERE address ILIKE '%Laurel Bridge%Smyrna%' OR name ILIKE '%scandinavian%retreat%';

-- Homerun Hideaway - Smyrna (need to identify which one)
UPDATE public.properties
SET ical_url = 'https://app.ownerrez.com/feeds/ical/0e660e65cb994ae09bcc04223c0d2da7'
WHERE name ILIKE '%homerun%' OR name ILIKE '%home%run%';