-- Update the handle_new_user function to use admin@peachhausgroup.com
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin_email BOOLEAN;
BEGIN
  -- Check if this is an admin email - updated to use admin@peachhausgroup.com
  _is_admin_email := NEW.email IN ('admin@peachhausgroup.com', 'anja@peachhausgroup.com');
  
  -- Insert profile with approved status for admin emails, pending for others
  INSERT INTO public.profiles (id, email, status, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    CASE WHEN _is_admin_email THEN 'approved'::account_status ELSE 'pending'::account_status END,
    false  -- Keep this for backward compatibility but use user_roles table instead
  );
  
  -- Grant admin role to admin emails
  IF _is_admin_email THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Grant user role to regular users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$function$;