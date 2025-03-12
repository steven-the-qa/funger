/*
  Enable Garden Ornaments Feature

  This migration switches from the original garden stats function to the new one
  that supports random ornament rewards.
  
  This should only be run after testing the garden_ornaments table and ensuring 
  the update_garden_stats_with_ornaments() function works as expected.
*/

-- First, drop the existing trigger to prevent conflicts
DROP TRIGGER IF EXISTS grass_session_completed_trigger ON public.grass_sessions;

-- Then recreate it with the new function
CREATE TRIGGER grass_session_completed_trigger
AFTER UPDATE ON public.grass_sessions
FOR EACH ROW
WHEN (OLD.completed = false AND NEW.completed = true)
EXECUTE FUNCTION public.update_garden_stats_with_ornaments();

-- Add migration version to track changes
INSERT INTO public.migrations (name, executed_at) 
VALUES ('enable_garden_ornaments', NOW())
ON CONFLICT DO NOTHING; 