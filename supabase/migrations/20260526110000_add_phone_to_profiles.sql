-- Add phone column to public.profiles
ALTER TABLE public.profiles ADD COLUMN phone TEXT;

-- Update handle_new_user function to include phone and support full_name/display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'phone',
      NEW.phone
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$;

-- Populate phone for existing users
UPDATE public.profiles p
SET phone = COALESCE(u.raw_user_meta_data->>'phone', u.phone)
FROM auth.users u
WHERE p.id = u.id AND p.phone IS NULL;
