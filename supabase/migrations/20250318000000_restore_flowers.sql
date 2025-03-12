/*
  Restore Flowers Migration
  
  This migration restores flowers that may have been lost during the garden ornaments feature implementation.
  It updates each user's flower counts based on their total completed sessions.
*/

-- First, restore the user_garden_stats for users who still have data
UPDATE public.user_garden_stats
SET 
  total_flowers_earned = total_sessions_completed,
  flowers_available = total_sessions_completed - COALESCE(
    (SELECT COUNT(*) FROM public.garden_items WHERE garden_items.user_id = user_garden_stats.user_id AND plant_type != 'flower'), 
    0
  )
WHERE true;

-- This ensures that for each user:
-- 1. They get credit for a flower for every session they've completed
-- 2. Their available flowers account for ones already used to purchase plants

-- Fix the update_garden_stats function to use our safer implementation
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