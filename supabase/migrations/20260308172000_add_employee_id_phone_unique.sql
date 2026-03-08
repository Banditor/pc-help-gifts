-- Add identity fields for preventing duplicate employee registration
ALTER TABLE public.gift_selections
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Keep one selection per employee id (for rows that include employee_id)
CREATE UNIQUE INDEX IF NOT EXISTS gift_selections_employee_id_unique
  ON public.gift_selections (employee_id)
  WHERE employee_id IS NOT NULL;
