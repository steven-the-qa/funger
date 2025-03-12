/*
  Safe Garden Ornaments Update Script
  
  This script updates or creates garden ornament functionality safely,
  handling the case where some objects might already exist.
*/

-- Create garden_ornaments table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS public.garden_ornaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ornament_type TEXT NOT NULL,
  position_x INTEGER NOT NULL,
  position_y INTEGER NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.garden_ornaments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors)
DO $$
BEGIN
    -- Drop insert policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'garden_ornaments' 
        AND policyname = 'Users can insert their own garden ornaments'
    ) THEN
        DROP POLICY "Users can insert their own garden ornaments" ON public.garden_ornaments;
    END IF;
    
    -- Drop select policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'garden_ornaments' 
        AND policyname = 'Users can view their own garden ornaments'
    ) THEN
        DROP POLICY "Users can view their own garden ornaments" ON public.garden_ornaments;
    END IF;
    
    -- Drop update policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'garden_ornaments' 
        AND policyname = 'Users can update their own garden ornaments'
    ) THEN
        DROP POLICY "Users can update their own garden ornaments" ON public.garden_ornaments;
    END IF;
    
    -- Drop delete policy if it exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'garden_ornaments' 
        AND policyname = 'Users can delete their own garden ornaments'
    ) THEN
        DROP POLICY "Users can delete their own garden ornaments" ON public.garden_ornaments;
    END IF;
END $$;

-- Re-create policies
CREATE POLICY "Users can insert their own garden ornaments"
  ON public.garden_ornaments
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own garden ornaments"
  ON public.garden_ornaments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own garden ornaments"
  ON public.garden_ornaments
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garden ornaments"
  ON public.garden_ornaments
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add reward_type column to grass_sessions if it doesn't exist yet
ALTER TABLE public.grass_sessions 
ADD COLUMN IF NOT EXISTS reward_type TEXT;

-- Create or replace the ornament bonus function
CREATE OR REPLACE FUNCTION public.update_garden_stats_with_ornaments()
RETURNS TRIGGER AS $$
DECLARE
  random_num DECIMAL;
  give_ornament BOOLEAN;
BEGIN
  -- Only update stats if the session was completed successfully
  IF NEW.completed = true THEN
    -- Always increment sessions and flowers for every completion
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
    
    -- 20% chance to ALSO give an ornament as a bonus
    SELECT random() INTO random_num;
    give_ornament := random_num < 0.2;
    
    -- Record the reward type for the frontend
    UPDATE public.grass_sessions
    SET 
      reward_type = CASE WHEN give_ornament THEN 'ornament_bonus' ELSE 'flower' END
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment on function
COMMENT ON FUNCTION public.update_garden_stats_with_ornaments IS 
  'Updated function that gives ornaments as bonuses (20% chance) without replacing flower rewards';

-- Fix standard garden stats function to always give flowers
CREATE OR REPLACE FUNCTION public.update_garden_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats if the session was completed successfully
  IF NEW.completed = true THEN
    -- Always increment sessions and flowers for every completion
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

-- Comment on function
COMMENT ON FUNCTION public.update_garden_stats IS 
  'Updates user garden statistics when a grass session is completed, ensuring a flower is always earned';

-- Make sure the trigger uses the right function
DROP TRIGGER IF EXISTS on_grass_session_update ON public.grass_sessions;

CREATE TRIGGER on_grass_session_update
AFTER UPDATE ON public.grass_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_garden_stats();

-- Restore any lost flowers (if any)
UPDATE public.user_garden_stats ugs
SET 
  total_flowers_earned = GREATEST(ugs.total_flowers_earned, gs.completed_count),
  flowers_available = GREATEST(
    ugs.flowers_available,
    gs.completed_count - COALESCE(
      (SELECT COUNT(*) FROM public.garden_plants gp WHERE gp.user_id = ugs.user_id),
      0
    )
  )
FROM (
  SELECT 
    user_id, 
    COUNT(*) as completed_count
  FROM public.grass_sessions
  WHERE completed = true
  GROUP BY user_id
) gs
WHERE ugs.user_id = gs.user_id; 