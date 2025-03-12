/*
  Safe Garden Ornaments Feature Implementation
  
  This adds garden ornaments as random rewards from Touch Grass sessions
  WITHOUT disrupting existing users' flowers.
  
  Users have a 20% chance of earning an ornament ALONG WITH a flower.
  This means they always get a flower, but sometimes get a bonus ornament.
*/

-- Create a new table for garden ornaments WITHOUT affecting existing data
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

-- Add RLS policies for garden_ornaments
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

-- Create a safer function that gives ornaments as BONUSES rather than alternatives
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
    
    -- Record the reward type for the frontend (stored as a session property)
    UPDATE public.grass_sessions
    SET 
      reward_type = CASE WHEN give_ornament THEN 'ornament_bonus' ELSE 'flower' END
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a comment for the safer function
COMMENT ON FUNCTION public.update_garden_stats_with_ornaments IS 'Updated function that gives ornaments as bonuses (20% chance) without replacing flower rewards';

-- Add a reward_type column to grass_sessions to store what was earned
ALTER TABLE public.grass_sessions 
ADD COLUMN IF NOT EXISTS reward_type TEXT; 