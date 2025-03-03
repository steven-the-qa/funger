/*
  # Create hunger records table

  1. New Tables
    - `hunger_records`
      - `id` (uuid, primary key)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      - `start_time` (timestamp)
      - `end_time` (timestamp, nullable)
      - `duration_seconds` (integer, nullable)
  2. Security
    - Enable RLS on `hunger_records` table
    - Add policies for authenticated users to manage their own records
*/

CREATE TABLE IF NOT EXISTS hunger_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_seconds integer
);

ALTER TABLE hunger_records ENABLE ROW LEVEL SECURITY;

-- Policy for users to insert their own records
CREATE POLICY "Users can insert their own hunger records"
  ON hunger_records
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy for users to select their own records
CREATE POLICY "Users can view their own hunger records"
  ON hunger_records
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to update their own records
CREATE POLICY "Users can update their own hunger records"
  ON hunger_records
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy for users to delete their own records
CREATE POLICY "Users can delete their own hunger records"
  ON hunger_records
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);