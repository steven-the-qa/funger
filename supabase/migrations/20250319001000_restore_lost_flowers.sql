/*
  Restore Lost Flowers Migration
  
  This migration restores any flowers that may have been lost
  when the garden ornaments feature was initially implemented.
  
  It updates user_garden_stats to ensure users have the correct
  number of flowers based on their completed sessions.
*/

-- First, restore the total flowers earned and available based on sessions
UPDATE public.user_garden_stats ugs
SET 
  total_flowers_earned = gs.completed_count,
  flowers_available = gs.completed_count - COALESCE(
    (SELECT COUNT(*) 
     FROM public.garden_plants gp 
     WHERE gp.user_id = ugs.user_id),
    0
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

-- Replace the trigger function with one that always gives a flower for completed sessions
DROP TRIGGER IF EXISTS on_grass_session_update ON public.grass_sessions;

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

-- Re-create the trigger with the corrected function
CREATE TRIGGER on_grass_session_update
AFTER UPDATE ON public.grass_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_garden_stats();

COMMENT ON FUNCTION public.update_garden_stats IS 'Updates user garden statistics when a grass session is completed, ensuring a flower is always earned.'; 