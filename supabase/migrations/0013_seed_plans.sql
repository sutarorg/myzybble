-- Zybble — 0013: pricing seed data
--
-- The six monthly USD tiers (§10). These values are authoritative: the client
-- must never decide price, quota or entitlement.

insert into public.plans (code, name, price_cents, currency, interval, monthly_leads, sort_order, features)
values
  ('free',      'Free',        0,     'USD', 'monthly',   100,  0, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('starter',   'Starter',     1900,  'USD', 'monthly',  5000,  1, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('growth',    'Growth',      3900,  'USD', 'monthly', 15000,  2, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('pro',       'Pro',         6900,  'USD', 'monthly', 30000,  3, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('scale',     'Scale',       9900,  'USD', 'monthly', 50000,  4, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('business',  'Business',   14900,  'USD', 'monthly', 75000,  5, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb),
  ('agency',    'Agency',     19900,  'USD', 'monthly',100000,  6, '{"email_data":true,"phone_data":true,"csv_export":true,"ai_assistant":true,"campaigns":true}'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  monthly_leads = excluded.monthly_leads,
  sort_order = excluded.sort_order,
  features = excluded.features,
  is_active = true,
  updated_at = now();
