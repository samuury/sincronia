-- Add unlimited_sessions column to public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unlimited_sessions BOOLEAN NOT NULL DEFAULT false;
