-- Update visit prices to match current property visit_price
UPDATE public.visits v
SET price = p.visit_price
FROM public.properties p
WHERE v.property_id = p.id;