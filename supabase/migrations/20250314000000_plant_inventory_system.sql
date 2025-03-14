-- Create the user_plant_inventory table to store plants that aren't currently placed in the garden
CREATE TABLE IF NOT EXISTS user_plant_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plant inventory for each type and variant
  -- Flowers
  flower_basic INTEGER DEFAULT 0,
  flower_rare INTEGER DEFAULT 0,
  flower_epic INTEGER DEFAULT 0,
  flower_legendary INTEGER DEFAULT 0,
  
  -- Veggies
  veggie_basic INTEGER DEFAULT 0,
  veggie_rare INTEGER DEFAULT 0,
  veggie_epic INTEGER DEFAULT 0,
  veggie_legendary INTEGER DEFAULT 0,
  
  -- Fruits
  fruit_basic INTEGER DEFAULT 0,
  fruit_rare INTEGER DEFAULT 0,
  fruit_epic INTEGER DEFAULT 0,
  fruit_legendary INTEGER DEFAULT 0,
  
  -- Trees
  tree_basic INTEGER DEFAULT 0,
  tree_rare INTEGER DEFAULT 0,
  tree_epic INTEGER DEFAULT 0,
  tree_legendary INTEGER DEFAULT 0,
  
  -- Luck plants
  luck_basic INTEGER DEFAULT 0,
  luck_rare INTEGER DEFAULT 0,
  luck_epic INTEGER DEFAULT 0,
  luck_legendary INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint to ensure uniqueness
  CONSTRAINT user_plant_inventory_user_id_key UNIQUE (user_id)
);

-- Add RLS policies to protect the data
ALTER TABLE user_plant_inventory ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to read their own inventory
CREATE POLICY "Users can read their own plant inventory" 
ON user_plant_inventory FOR SELECT 
USING (auth.uid() = user_id);

-- Policy to allow users to update their own inventory
CREATE POLICY "Users can update their own plant inventory" 
ON user_plant_inventory FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy to allow users to insert their own inventory
CREATE POLICY "Users can insert their own plant inventory" 
ON user_plant_inventory FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_plant_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plant_inventory_timestamp
BEFORE UPDATE ON user_plant_inventory
FOR EACH ROW
EXECUTE FUNCTION update_plant_inventory_updated_at();

-- Insert default records for existing users
INSERT INTO user_plant_inventory (user_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_plant_inventory)
ON CONFLICT (user_id) DO NOTHING; 