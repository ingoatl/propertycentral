-- Create table for caching owner 360 context
CREATE TABLE public.owner_context_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES public.property_owners(id) ON DELETE CASCADE,
  context_data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '4 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_owner_context UNIQUE (owner_id)
);

-- Enable RLS
ALTER TABLE public.owner_context_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read owner context
CREATE POLICY "Authenticated users can view owner context"
ON public.owner_context_cache
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Create policy for service role to manage cache (via edge functions)
CREATE POLICY "Service role can manage owner context cache"
ON public.owner_context_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_owner_context_cache_owner_id ON public.owner_context_cache(owner_id);
CREATE INDEX idx_owner_context_cache_expires_at ON public.owner_context_cache(expires_at);

-- Create trigger for updated_at
CREATE TRIGGER update_owner_context_cache_updated_at
  BEFORE UPDATE ON public.owner_context_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();