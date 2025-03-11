/*
  # Create Cookie Rewards System

  1. New Tables
    - `cookie_rewards`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `hunger_record_id` (uuid, references hunger_records, nullable)
      - `cookie_type` (text)
      - `milestone` (text, nullable)
      - `streak_count` (integer, nullable)
    - `user_cookie_stats`
      - `user_id` (uuid, primary key, references auth.users)
      - `total_cookies` (integer)
      - `current_streak` (integer)
      - `longest_streak` (integer)
      - `last_cookie_date` (timestamp)
  2. Functions
    - `update_cookie_streak()` - Function to update streak counts
    - `cookie_earned_trigger` - Trigger that executes when a cookie is earned
  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own cookie data
*/

-- Create cookie_rewards table
CREATE TABLE IF NOT EXISTS cookie_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  hunger_record_id uuid REFERENCES hunger_records(id),
  cookie_type text NOT NULL,
  milestone text,
  streak_count integer
);

-- Create user_cookie_stats table
CREATE TABLE IF NOT EXISTS user_cookie_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  total_cookies integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_cookie_date timestamptz
);

-- Create streak management function
CREATE OR REPLACE FUNCTION update_cookie_streak()
RETURNS TRIGGER AS $$
DECLARE
  last_cookie_time timestamptz;
  current_user_streak integer;
  longest_user_streak integer;
BEGIN
  -- Get the user's current stats
  SELECT 
    last_cookie_date, 
    current_streak, 
    longest_streak
  INTO 
    last_cookie_time, 
    current_user_streak, 
    longest_user_streak
  FROM 
    user_cookie_stats
  WHERE 
    user_id = NEW.user_id;
  
  -- If this is the user's first cookie, create a new stats record
  IF NOT FOUND THEN
    INSERT INTO user_cookie_stats (
      user_id, 
      total_cookies, 
      current_streak, 
      longest_streak, 
      last_cookie_date
    ) VALUES (
      NEW.user_id, 
      1, 
      1, 
      1, 
      NEW.created_at
    );
    
    -- Set the streak count for this cookie
    NEW.streak_count := 1;
  ELSE
    -- Update existing stats
    IF last_cookie_time IS NULL OR 
       (NEW.created_at - last_cookie_time) > interval '36 hours' THEN
      -- Reset streak (more than 36 hours since last cookie)
      current_user_streak := 1;
    ELSE
      -- Continue streak
      current_user_streak := current_user_streak + 1;
    END IF;
    
    -- Update longest streak if needed
    IF current_user_streak > longest_user_streak THEN
      longest_user_streak := current_user_streak;
    END IF;
    
    -- Update the user's stats
    UPDATE user_cookie_stats
    SET 
      total_cookies = total_cookies + 1,
      current_streak = current_user_streak,
      longest_streak = longest_user_streak,
      last_cookie_date = NEW.created_at
    WHERE 
      user_id = NEW.user_id;
    
    -- Set the streak count for this cookie
    NEW.streak_count := current_user_streak;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cookie rewards
CREATE TRIGGER cookie_earned_trigger
BEFORE INSERT ON cookie_rewards
FOR EACH ROW
EXECUTE FUNCTION update_cookie_streak();

-- Enable Row Level Security
ALTER TABLE cookie_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cookie_stats ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for cookie_rewards
CREATE POLICY "Users can insert their own cookie rewards"
  ON cookie_rewards
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cookie rewards"
  ON cookie_rewards
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own cookie rewards"
  ON cookie_rewards
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cookie rewards"
  ON cookie_rewards
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add RLS policies for user_cookie_stats
CREATE POLICY "Users can insert their own cookie stats"
  ON user_cookie_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own cookie stats"
  ON user_cookie_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own cookie stats"
  ON user_cookie_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cookie stats"
  ON user_cookie_stats
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id); 