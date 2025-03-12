/*
  Rollback Garden Ornaments Feature
  
  This migration rolls back the garden ornaments feature if issues are encountered.
  It restores the original trigger function but leaves the garden_ornaments table intact
  to avoid data loss.
  
  DO NOT run this migration unless there are issues with the garden ornaments feature.
*/

-- First, drop the trigger using the new function
DROP TRIGGER IF EXISTS grass_session_completed_trigger ON public.grass_sessions;

-- Then recreate it with the original function
CREATE TRIGGER grass_session_completed_trigger
AFTER UPDATE ON public.grass_sessions
FOR EACH ROW
WHEN (OLD.completed = false AND NEW.completed = true)
EXECUTE FUNCTION public.update_garden_stats();

-- Add migration version to track changes
INSERT INTO public.migrations (name, executed_at) 
VALUES ('rollback_garden_ornaments', NOW())
ON CONFLICT DO NOTHING;

-- Add a comment explaining the rollback
COMMENT ON FUNCTION public.update_garden_stats_with_ornaments IS 'DISABLED: This function was disabled by a rollback. The original update_garden_stats function is being used instead.'; 