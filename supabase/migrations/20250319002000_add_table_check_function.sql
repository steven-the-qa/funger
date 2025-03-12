/*
  Add Table Check Function
  
  This migration adds a simple function that client code can use to check
  if a particular table exists in the database.
  
  This helps with feature detection, allowing the client to gracefully handle
  the case where the ornaments feature is not fully enabled yet.
*/

-- Function to check if a table exists
CREATE OR REPLACE FUNCTION public.check_if_table_exists(table_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  table_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = $1
  ) INTO table_exists;
  
  RETURN table_exists;
END;
$$;

-- Add RLS policy to allow any authenticated user to call this function
REVOKE ALL ON FUNCTION public.check_if_table_exists(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_if_table_exists(text) TO authenticated;

COMMENT ON FUNCTION public.check_if_table_exists IS 'Checks if a table exists in the public schema. Used for feature detection in client code.'; 