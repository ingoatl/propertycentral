-- Create table for storing PeachHaus property performance data
CREATE TABLE public.property_peachhaus_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  ownerrez_id TEXT,
  sync_date DATE NOT NULL DEFAULT CURRENT_DATE,
  listing_health JSONB DEFAULT '{}',
  pricing_intelligence JSONB DEFAULT '{}',
  recent_optimizations JSONB DEFAULT '[]',
  revenue_alerts JSONB DEFAULT '[]',
  performance_trends JSONB DEFAULT '{}',
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT unique_property_sync_date UNIQUE (property_id, sync_date)
);

-- Enable RLS
ALTER TABLE public.property_peachhaus_stats ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_peachhaus_stats_property ON public.property_peachhaus_stats(property_id);
CREATE INDEX idx_peachhaus_stats_sync_date ON public.property_peachhaus_stats(sync_date DESC);

-- RLS policy: Allow authenticated users to read stats for properties they can access
CREATE POLICY "Users can view peachhaus stats for accessible properties"
ON public.property_peachhaus_stats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_id
  )
);

-- Add comment for documentation
COMMENT ON TABLE public.property_peachhaus_stats IS 'Stores daily property performance data synced from PeachHaus revenue management tool';