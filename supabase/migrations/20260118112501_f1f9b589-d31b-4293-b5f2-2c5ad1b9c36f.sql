-- Drop existing restrictive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read knowledge" ON public.company_knowledge_base;

-- Create public read policy so knowledge base can be accessed
CREATE POLICY "Anyone can read knowledge" 
ON public.company_knowledge_base 
FOR SELECT 
USING (true);