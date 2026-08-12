INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Nhà xe', 'Khu vực gửi xe và lối ra vào nhà xe', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Nhà xe' COLLATE utf8mb4_unicode_ci);
SET @area_parking = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Nhà xe' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Nhà võ', 'Khu vực nhà võ và không gian sinh hoạt thể chất', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Nhà võ' COLLATE utf8mb4_unicode_ci);
SET @area_martial = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Nhà võ' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Ký túc xá', 'Khu vực ký túc xá sinh viên', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Ký túc xá' COLLATE utf8mb4_unicode_ci);
SET @area_dorm = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Ký túc xá' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Tòa', 'Các tòa học tập và làm việc trong campus', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Tòa' COLLATE utf8mb4_unicode_ci);
SET @area_building = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Tòa' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Khu thể thao', 'Sân và khu vực thể thao trong campus', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Khu thể thao' COLLATE utf8mb4_unicode_ci);
SET @area_sport = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Khu thể thao' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Cổng', 'Các cổng ra vào campus', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Cổng' COLLATE utf8mb4_unicode_ci);
SET @area_gate = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Cổng' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_areas (id, name, description, sort_order)
SELECT UUID(), 'Căn tin', 'Khu vực căn tin và ăn uống', 0
WHERE NOT EXISTS (SELECT 1 FROM campus_areas WHERE name = _utf8mb4'Căn tin' COLLATE utf8mb4_unicode_ci);
SET @area_canteen = (
  SELECT id FROM campus_areas WHERE name = _utf8mb4'Căn tin' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_building, 'Tòa Alpha', 0
WHERE @area_building IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_building AND name = _utf8mb4'Tòa Alpha' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_building, 'Tòa Beta', 0
WHERE @area_building IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_building AND name = _utf8mb4'Tòa Beta' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_building, 'Tòa Gamma', 0
WHERE @area_building IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_building AND name = _utf8mb4'Tòa Gamma' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_gate, 'Cổng chính', 0
WHERE @area_gate IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_gate AND name = _utf8mb4'Cổng chính' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_gate, 'Cổng phụ', 0
WHERE @area_gate IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_gate AND name = _utf8mb4'Cổng phụ' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_gate, 'Cổng nhà xe', 0
WHERE @area_gate IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_gate AND name = _utf8mb4'Cổng nhà xe' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_parking, 'Nhà xe sinh viên', 0
WHERE @area_parking IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_parking AND name = _utf8mb4'Nhà xe sinh viên' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_parking, 'Nhà xe giảng viên', 0
WHERE @area_parking IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_parking AND name = _utf8mb4'Nhà xe giảng viên' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_sport, 'Sân bóng', 0
WHERE @area_sport IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_sport AND name = _utf8mb4'Sân bóng' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_sport, 'Sân bóng rổ', 0
WHERE @area_sport IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_sport AND name = _utf8mb4'Sân bóng rổ' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_dorm, 'Khu ký túc xá nam', 0
WHERE @area_dorm IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_dorm AND name = _utf8mb4'Khu ký túc xá nam' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_dorm, 'Khu ký túc xá nữ', 0
WHERE @area_dorm IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_dorm AND name = _utf8mb4'Khu ký túc xá nữ' COLLATE utf8mb4_unicode_ci
  );

INSERT INTO campus_buildings (id, area_id, name, sort_order)
SELECT UUID(), @area_canteen, 'Căn tin chính', 0
WHERE @area_canteen IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM campus_buildings
    WHERE area_id = @area_canteen AND name = _utf8mb4'Căn tin chính' COLLATE utf8mb4_unicode_ci
  );
