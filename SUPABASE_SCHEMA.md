# Supabase Database Schema for Surftober Landing Page

## Required Profile Fields

The `profiles` table needs to be updated to include the following additional columns for the registration flow:

```sql
-- Add new columns to the profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS target_hours TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS charity_commitment TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sponsor_match TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_based TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fun_comment TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS photo_base64 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS additional_comments TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS registered_at TIMESTAMP WITH TIME ZONE;
```

## Complete Profiles Table Schema

```sql
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  target_hours TEXT,
  charity_commitment TEXT,
  sponsor_match TEXT,
  location_based TEXT,
  whatsapp_phone TEXT,
  fun_comment TEXT,
  photo_base64 TEXT,
  additional_comments TEXT,
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Policy: Users can delete their own profile
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE USING (auth.uid() = id);
```

## Notes

- All new fields are TEXT type for flexibility
- `photo_base64` stores the base64-encoded image data (without the data:image prefix)
- `registered_at` timestamp tracks when the user completed registration
- RLS policies ensure users can only access their own profile data
- The `display_name` field is required and used throughout the app for session logging
