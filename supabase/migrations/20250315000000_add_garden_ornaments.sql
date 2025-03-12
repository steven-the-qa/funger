/*
  Create Garden Ornaments Feature

  This adds garden ornaments as random rewards from Touch Grass sessions.
  Users have a 20% chance of earning an ornament instead of a flower.
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

-- Create a NEW function for handling garden stats with ornaments
-- This preserves the original function behavior while adding new functionality
CREATE OR REPLACE FUNCTION public.update_garden_stats_with_ornaments()
RETURNS TRIGGER AS $$
DECLARE
  random_num DECIMAL;
  reward_type TEXT;
BEGIN
  -- Only update stats if the session was completed successfully
  IF NEW.completed = true THEN
    -- Generate a random number between 0 and 1
    SELECT random() INTO random_num;
    
    -- 20% chance of getting an ornament, 80% chance of getting a flower
    IF random_num < 0.2 THEN
      reward_type := 'ornament';
    ELSE
      reward_type := 'flower';
    END IF;
    
    -- Always increment total sessions completed
    INSERT INTO public.user_garden_stats (
      user_id,
      total_sessions_completed,
      total_flowers_earned,
      flowers_available
    )
    VALUES (
      NEW.user_id,
      1,
      CASE WHEN reward_type = 'flower' THEN 1 ELSE 0 END,
      CASE WHEN reward_type = 'flower' THEN 1 ELSE 0 END
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
      total_sessions_completed = public.user_garden_stats.total_sessions_completed + 1,
      total_flowers_earned = CASE WHEN reward_type = 'flower' 
                             THEN public.user_garden_stats.total_flowers_earned + 1 
                             ELSE public.user_garden_stats.total_flowers_earned END,
      flowers_available = CASE WHEN reward_type = 'flower' 
                          THEN public.user_garden_stats.flowers_available + 1 
                          ELSE public.user_garden_stats.flowers_available END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- NOTE: We don't immediately replace the existing trigger yet
-- This allows for safe migration and testing

-- Create a comment for user_garden_stats to document the ornament feature
COMMENT ON TABLE public.garden_ornaments IS 'Stores decorative ornaments that users can earn with a 20% chance from completed Touch Grass sessions';

-- Create a comment for the previous update_garden_stats function
COMMENT ON FUNCTION public.update_garden_stats IS 'DEPRECATED: Original function for updating garden stats when grass sessions are completed. Use update_garden_stats_with_ornaments instead.';

-- Create a comment for the new function
COMMENT ON FUNCTION public.update_garden_stats_with_ornaments IS 'Updated function for garden stats with 20% chance for ornaments and 80% chance for flowers';

-- Add migration version to track changes
INSERT INTO public.migrations (name, executed_at) 
VALUES ('add_garden_ornaments', NOW())
ON CONFLICT DO NOTHING; 