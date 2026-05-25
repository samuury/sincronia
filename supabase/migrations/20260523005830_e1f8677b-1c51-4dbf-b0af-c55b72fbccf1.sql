
DO $$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_login_email text := '11912345678@sinc.login';
  v_password text := 'teste@teste.com';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = v_login_email) THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
      v_login_email, crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name','Usuário Teste','phone','11912345678','contact_email','teste@teste.com'),
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_login_email),
      'email', v_login_email, now(), now(), now());
  END IF;
END $$;
