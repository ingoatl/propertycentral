-- Delete ALL duplicate TV expenses (keep only the most recent one for Canadian Way)
DELETE FROM expenses
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY property_id, amount
             ORDER BY created_at DESC
           ) as rn
    FROM expenses
    WHERE (amount = 679.96 OR amount = 360.38 OR amount = 339.98)
    AND purpose ILIKE '%TV%'
    OR purpose ILIKE '%INSIGNIA%'
  ) sub
  WHERE rn > 1
);

-- Delete ALL duplicate Photo Shoot expenses (keep only the most recent one)
DELETE FROM expenses
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (
             PARTITION BY property_id
             ORDER BY created_at DESC
           ) as rn
    FROM expenses
    WHERE amount = 725.17
    AND purpose ILIKE '%Photo%'
  ) sub
  WHERE rn > 1
);