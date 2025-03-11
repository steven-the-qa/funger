/*
  # Create Touch Grass Garden Feature

  1. New Tables
    - `grass_sessions`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `start_time` (timestamp)
      - `end_time` (timestamp, nullable)
      - `completed` (boolean, default false)
      - `duration_minutes` (integer, default 30)
    - `garden_items`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `plant_type` (text) - 'flower', 'bush', 'tree', etc.
      - `plant_variant` (text) - specific variant within type
      - `position_x` (integer) - position in garden grid
      - `position_y` (integer) - position in garden grid
    - `user_garden_stats`
      - `user_id` (uuid, primary key, references auth.users)
      - `total_sessions_completed` (integer, default 0)
      - `total_flowers_earned` (integer, default 0)
      - `flowers_available` (integer, default 0) - unspent flowers
      - `next_upgrade_threshold` (integer, default 5)
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own garden data
*/

-- Create grass_sessions table
CREATE TABLE IF NOT EXISTS grass_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  completed boolean DEFAULT false,
  duration_minutes integer DEFAULT 30
);

-- Create garden_items table
CREATE TABLE IF NOT EXISTS garden_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  plant_type text NOT NULL,
  plant_variant text NOT NULL,
  position_x integer NOT NULL,
  position_y integer NOT NULL
);

-- Create user_garden_stats table
CREATE TABLE IF NOT EXISTS user_garden_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  total_sessions_completed integer DEFAULT 0,
  total_flowers_earned integer DEFAULT 0,
  flowers_available integer DEFAULT 0,
  next_upgrade_threshold integer DEFAULT 5
);

-- Function to update user garden stats when session is completed
CREATE OR REPLACE FUNCTION update_garden_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update stats if the session was completed successfully
  IF NEW.completed = true THEN
    -- Check if user already has garden stats
    INSERT INTO user_garden_stats (
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
      total_sessions_completed = user_garden_stats.total_sessions_completed + 1,
      total_flowers_earned = user_garden_stats.total_flowers_earned + 1,
      flowers_available = user_garden_stats.flowers_available + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for completed grass sessions
CREATE TRIGGER grass_session_completed_trigger
AFTER UPDATE ON grass_sessions
FOR EACH ROW
WHEN (OLD.completed = false AND NEW.completed = true)
EXECUTE FUNCTION update_garden_stats();

-- Enable Row Level Security
ALTER TABLE grass_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE garden_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_garden_stats ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for grass_sessions
CREATE POLICY "Users can insert their own grass sessions"
  ON grass_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own grass sessions"
  ON grass_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own grass sessions"
  ON grass_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own grass sessions"
  ON grass_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add RLS policies for garden_items
CREATE POLICY "Users can insert their own garden items"
  ON garden_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own garden items"
  ON garden_items
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own garden items"
  ON garden_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garden items"
  ON garden_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add RLS policies for user_garden_stats
CREATE POLICY "Users can insert their own garden stats"
  ON user_garden_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own garden stats"
  ON user_garden_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own garden stats"
  ON user_garden_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own garden stats"
  ON user_garden_stats
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id); 