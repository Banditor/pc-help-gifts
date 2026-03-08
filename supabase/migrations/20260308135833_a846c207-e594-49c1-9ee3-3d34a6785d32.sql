
-- Create gifts table
CREATE TABLE public.gifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create selections table
CREATE TABLE public.gift_selections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_name TEXT NOT NULL,
  work_site TEXT NOT NULL,
  department TEXT NOT NULL,
  gift_id UUID NOT NULL REFERENCES public.gifts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_selections ENABLE ROW LEVEL SECURITY;

-- Gifts: everyone can read active gifts
CREATE POLICY "Anyone can view active gifts" ON public.gifts
  FOR SELECT USING (active = true);

-- Gifts: allow all operations for admin management
CREATE POLICY "Allow all gift management" ON public.gifts
  FOR ALL USING (true) WITH CHECK (true);

-- Selections: anyone can insert
CREATE POLICY "Anyone can submit selection" ON public.gift_selections
  FOR INSERT WITH CHECK (true);

-- Selections: anyone can read (for admin export)
CREATE POLICY "Anyone can read selections" ON public.gift_selections
  FOR SELECT USING (true);
