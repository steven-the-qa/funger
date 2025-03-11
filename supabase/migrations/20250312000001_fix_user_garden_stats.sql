/*
  Fix for user_garden_stats table to match original structure
*/

-- Drop and recreate user_garden_stats with the original structure
DROP TABLE IF EXISTS public.user_garden_stats;

CREATE TABLE IF NOT EXISTS public.user_garden_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions_completed INTEGER DEFAULT 0,
  total_flowers_earned INTEGER DEFAULT 0,
  flowers_available INTEGER DEFAULT 0,
  next_upgrade_threshold INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.user_garden_stats ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for user_garden_stats
CREATE POLICY "Users can insert their own garden stats"
  ON public.user_garden_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own garden stats"
  ON public.user_garden_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own garden stats"
  ON public.user_garden_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garden stats"
  ON public.user_garden_stats
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update the trigger function to work with the new schema
CREATE OR REPLACE FUNCTION public.update_garden_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats if the session was completed successfully
  IF NEW.completed = true THEN
    -- Check if user already has garden stats
    INSERT INTO public.user_garden_stats (
      user_id,
      total_sessions_completed,
      total_flowers_earned,
      flowers_available
    )
    VALUES (
      NEW.user_id,
      1,
      1,
      1
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      total_sessions_completed = public.user_garden_stats.total_sessions_completed + 1,
      total_flowers_earned = public.user_garden_stats.total_flowers_earned + 1,
      flowers_available = public.user_garden_stats.flowers_available + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql; 