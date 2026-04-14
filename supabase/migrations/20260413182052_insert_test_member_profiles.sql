/*
  # Insert test member profiles

  1. Data Changes
    - Creates 12 minimal auth.users entries to satisfy the foreign key constraint
    - Inserts 12 test profiles into the `profiles` table
    - Profiles have varied usernames, bios, premium status, and staggered creation dates

  2. Important Notes
    - Uses ON CONFLICT to avoid errors if data already exists
    - Premium members: sarah_lgbtq, juliette_b, nico_pride, remi_lgbtq34, marie_inclusive
    - These are test/demo users for the Members page
*/

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex_mtp@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '45 days', NOW()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sarah_lgbtq@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '30 days', NOW()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marco_34@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '25 days', NOW()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'juliette_b@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '20 days', NOW()),
  ('55555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'thomas_queer@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '18 days', NOW()),
  ('66666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'camille_mtp@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '15 days', NOW()),
  ('77777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'nico_pride@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '12 days', NOW()),
  ('88888888-8888-8888-8888-888888888888', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lea_sun@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '10 days', NOW()),
  ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'remi_lgbtq34@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '8 days', NOW()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sophie_v@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '5 days', NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kevin_mtp@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '3 days', NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'marie_inclusive@test.local', crypt('testpass123', gen_salt('bf')), NOW(), NOW() - interval '2 days', NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, username, bio, is_premium, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alex_mtp', 'Montpellierain passionne de culture et de soirees. Toujours partant pour decouvrir de nouveaux endroits.', false, NOW() - interval '45 days'),
  ('22222222-2222-2222-2222-222222222222', 'sarah_lgbtq', 'Militante et amoureuse de la ville rose. J adore les brunchs et les expos.', true, NOW() - interval '30 days'),
  ('33333333-3333-3333-3333-333333333333', 'marco_34', 'Barman le week-end, explorateur de lieux inclusifs toute la semaine.', false, NOW() - interval '25 days'),
  ('44444444-4444-4444-4444-444444444444', 'juliette_b', 'Fan de concerts et de vins naturels. Montpellier c est la vie.', true, NOW() - interval '20 days'),
  ('55555555-5555-5555-5555-555555555555', 'thomas_queer', 'Photographe et organisateur d evenements LGBT+. Toujours en mouvement.', false, NOW() - interval '18 days'),
  ('66666666-6666-6666-6666-666666666666', 'camille_mtp', 'Nouvelle arrivante a Montpellier, je decouvre la scene LGBT+ locale.', false, NOW() - interval '15 days'),
  ('77777777-7777-7777-7777-777777777777', 'nico_pride', 'Drag performer le samedi soir, graphiste la semaine. Life is a show.', true, NOW() - interval '12 days'),
  ('88888888-8888-8888-8888-888888888888', 'lea_sun', 'Yoga, massage et bons restos. La vie douce a Montpellier.', false, NOW() - interval '10 days'),
  ('99999999-9999-9999-9999-999999999999', 'remi_lgbtq34', 'President de l asso Arc-en-Ciel 34. Engage pour une ville plus inclusive.', true, NOW() - interval '8 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'sophie_v', 'Libraire et militante. Les livres changent le monde.', false, NOW() - interval '5 days'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'kevin_mtp', 'Amateur de soirees electro et de street art. Montpellier by night.', false, NOW() - interval '3 days'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'marie_inclusive', 'Medecin et ally. Convaincue que chacun merite un espace safe.', true, NOW() - interval '2 days')
ON CONFLICT (id) DO NOTHING;
