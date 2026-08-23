INSERT INTO handover_points (id, name, address, opening_hours, contact_info, is_active)
SELECT
  UUID(),
  'Campus Lost & Found Desk',
  'Phong CTSV - Toa Alpha',
  '08:00 - 17:30',
  'lostfound@fpt.edu.vn',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM handover_points
  WHERE name = 'Campus Lost & Found Desk'
);
