/*
  Fix for Garden Tables

  1. Ensure tables are created in the public schema
  2. Add unique constraint to prevent overlap in the garden grid
*/

-- Drop existing tables if they exist but are not in the public schema
DROP TABLE IF EXISTS garden_items;
DROP TABLE IF EXISTS user_garden_stats;
DROP TABLE IF EXISTS grass_sessions;

-- Recreate grass_sessions table in public schema
CREATE TABLE IF NOT EXISTS public.grass_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  completed BOOLEAN DEFAULT false,
  duration_minutes INTEGER DEFAULT 30
);

-- Recreate tables in public schema
CREATE TABLE IF NOT EXISTS public.garden_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_type VARCHAR(50) NOT NULL,
  plant_variant VARCHAR(50) NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL,
  UNIQUE(user_id, position_x, position_y)
);

CREATE TABLE IF NOT EXISTS public.user_garden_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions_completed INTEGER DEFAULT 0,
  total_flowers_earned INTEGER DEFAULT 0,
  flowers_available INTEGER DEFAULT 0,
  next_upgrade_threshold INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.grass_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.garden_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_garden_stats ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for grass_sessions
CREATE POLICY "Users can insert their own grass sessions"
  ON public.grass_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own grass sessions"
  ON public.grass_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own grass sessions"
  ON public.grass_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grass sessions"
  ON public.grass_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add RLS policies for garden_items
CREATE POLICY "Users can insert their own garden items"
  ON public.garden_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own garden items"
  ON public.garden_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own garden items"
  ON public.garden_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garden items"
  ON public.garden_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

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

-- Add grass session completed trigger for the public schema
DROP TRIGGER IF EXISTS grass_session_completed_trigger ON grass_sessions;
DROP FUNCTION IF EXISTS update_garden_stats();

-- Function to update user garden stats when session is completed
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

-- Create trigger for completed grass sessions
CREATE TRIGGER grass_session_completed_trigger
AFTER UPDATE ON public.grass_sessions
FOR EACH ROW
WHEN (OLD.completed = false AND NEW.completed = true)
EXECUTE FUNCTION public.update_garden_stats(); 