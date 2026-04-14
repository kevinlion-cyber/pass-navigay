/*
  # Replace test member profiles with realistic data

  1. Modified Tables
    - `profiles` - Updates 12 test members with:
      - Real French first names as usernames
      - Genuine-sounding bios in French
      - Avatar photos from pravatar.cc
      - Premium status for select members
      - Staggered creation dates

  2. Important Notes
    - Deletes existing test profiles first, then re-inserts with enriched data
    - Preserves favorite_categories and last_active_at from prior migration
*/

DELETE FROM profiles WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  '88888888-8888-8888-8888-888888888888',
  '99999999-9999-9999-9999-999999999999',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc'
);

INSERT INTO profiles (id, username, bio, avatar_url, is_premium, favorite_categories, last_active_at, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Alexandre', 'Montpellierain de coeur, fan de soirees et de bons restos. Toujours partant pour decouvrir de nouveaux endroits.', 'https://i.pravatar.cc/150?img=11', false, ARRAY['Soiree', 'Restaurant'], NOW() - interval '1 day', NOW() - interval '45 days'),
('22222222-2222-2222-2222-222222222222', 'Sarah', 'Amoureuse de la ville, des brunchs et des expos. La vie est trop courte pour les endroits tristes.', 'https://i.pravatar.cc/150?img=47', true, ARRAY['Brunch', 'Culture', 'Shopping'], NOW() - interval '3 hours', NOW() - interval '30 days'),
('33333333-3333-3333-3333-333333333333', 'Marco', 'Barman le week-end, curieux de nature. J''adore faire decouvrir les bons coins de Montpellier.', 'https://i.pravatar.cc/150?img=12', false, ARRAY['Soiree', 'Bien-etre'], NOW() - interval '2 days', NOW() - interval '25 days'),
('44444444-4444-4444-4444-444444444444', 'Juliette', 'Fan de concerts et de vins naturels. Montpellier c''est la vie.', 'https://i.pravatar.cc/150?img=48', true, ARRAY['Concert', 'Bar a vins', 'Restaurant'], NOW() - interval '5 hours', NOW() - interval '20 days'),
('55555555-5555-5555-5555-555555555555', 'Thomas', 'Photographe et organisateur d''evenements. Toujours en mouvement, rarement chez moi.', 'https://i.pravatar.cc/150?img=13', false, ARRAY['Culture', 'Soiree', 'Shopping'], NOW() - interval '12 hours', NOW() - interval '18 days'),
('66666666-6666-6666-6666-666666666666', 'Camille', 'Nouvelle a Montpellier, je decouvre la ville et cherche des bons plans et de belles rencontres.', 'https://i.pravatar.cc/150?img=49', false, ARRAY['Brunch', 'Bien-etre'], NOW() - interval '4 days', NOW() - interval '15 days'),
('77777777-7777-7777-7777-777777777777', 'Nicolas', 'Performer le samedi soir, graphiste la semaine. La vie est un spectacle.', 'https://i.pravatar.cc/150?img=14', true, ARRAY['Soiree', 'Concert', 'Culture'], NOW() - interval '6 hours', NOW() - interval '12 days'),
('88888888-8888-8888-8888-888888888888', 'Lea', 'Yoga, massage et bons restos. Je cherche la douceur dans tout ce que je fais.', 'https://i.pravatar.cc/150?img=50', false, ARRAY['Bien-etre', 'Restaurant', 'Brunch'], NOW() - interval '1 day', NOW() - interval '10 days'),
('99999999-9999-9999-9999-999999999999', 'Remi', 'Engage pour une ville plus inclusive et bienveillante. President d''une asso locale.', 'https://i.pravatar.cc/150?img=15', true, ARRAY['Culture', 'Soiree'], NOW() - interval '30 minutes', NOW() - interval '8 days'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sophie', 'Libraire passionnee. Les livres changent le monde, les bonnes adresses aussi.', 'https://i.pravatar.cc/150?img=51', false, ARRAY['Shopping', 'Culture'], NOW() - interval '3 days', NOW() - interval '5 days'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kevin', 'Amateur de bonne musique et de street art. Montpellier by night.', 'https://i.pravatar.cc/150?img=16', false, ARRAY['Soiree', 'Concert'], NOW() - interval '8 hours', NOW() - interval '3 days'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Marie', 'Medecin de jour, exploratrice de la ville le reste du temps. Convaincue que tout le monde merite un espace safe.', 'https://i.pravatar.cc/150?img=52', true, ARRAY['Bien-etre', 'Restaurant', 'Culture'], NOW() - interval '2 hours', NOW() - interval '2 days');
