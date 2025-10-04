-- Create properties table
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  visit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create visits table
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  purpose TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required)
CREATE POLICY "Anyone can view properties" ON public.properties FOR SELECT USING (true);
CREATE POLICY "Anyone can insert properties" ON public.properties FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update properties" ON public.properties FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete properties" ON public.properties FOR DELETE USING (true);

CREATE POLICY "Anyone can view visits" ON public.visits FOR SELECT USING (true);
CREATE POLICY "Anyone can insert visits" ON public.visits FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update visits" ON public.visits FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete visits" ON public.visits FOR DELETE USING (true);

CREATE POLICY "Anyone can view expenses" ON public.expenses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert expenses" ON public.expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update expenses" ON public.expenses FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete expenses" ON public.expenses FOR DELETE USING (true);

-- Insert the four properties
INSERT INTO public.properties (name, address, visit_price) VALUES
  ('Villa Ct SE - Unit 14', '14 Villa Ct SE, Smyrna, GA 30080', 150.00),
  ('Villa Ct SE - Unit 15', '15 Villa Ct SE, Smyrna, GA 30080', 150.00),
  ('Woodland Lane', '184 Woodland Ln SW, Mableton, GA 30126', 175.00),
  ('Canadian Way', '3708 Canadian Way, Tucker, GA', 150.00);