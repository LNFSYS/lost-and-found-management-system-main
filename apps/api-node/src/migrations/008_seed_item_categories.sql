INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Giấy tờ cá nhân', 'giay to ca nhan', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'giay to ca nhan' COLLATE utf8mb4_unicode_ci
);
SET @cat_documents = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'giay to ca nhan' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Thẻ sinh viên', 'the sinh vien', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'the sinh vien' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'CCCD / CMND', 'cccd / cmnd', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'cccd / cmnd' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Bằng lái xe', 'bang lai xe', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'bang lai xe' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Thẻ ngân hàng', 'the ngan hang', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'the ngan hang' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Giấy tờ xe', 'giay to xe', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'giay to xe' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Hồ sơ / tài liệu', 'ho so / tai lieu', NULL, @cat_documents, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'ho so / tai lieu' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Thiết bị điện tử', 'thiet bi dien tu', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'thiet bi dien tu' COLLATE utf8mb4_unicode_ci
);
SET @cat_electronics = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'thiet bi dien tu' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Điện thoại', 'dien thoai', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'dien thoai' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Laptop', 'laptop', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'laptop' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Máy tính bảng', 'may tinh bang', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'may tinh bang' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Tai nghe', 'tai nghe', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'tai nghe' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Sạc / cáp', 'sac / cap', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'sac / cap' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'USB / ổ cứng', 'usb / o cung', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'usb / o cung' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Chuột / bàn phím', 'chuot / ban phim', NULL, @cat_electronics, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'chuot / ban phim' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Túi ví & phụ kiện', 'tui vi & phu kien', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'tui vi & phu kien' COLLATE utf8mb4_unicode_ci
);
SET @cat_bags = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'tui vi & phu kien' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Balo', 'balo', NULL, @cat_bags, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'balo' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Túi xách', 'tui xach', NULL, @cat_bags, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'tui xach' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Ví / bóp', 'vi / bop', NULL, @cat_bags, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'vi / bop' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Túi đựng laptop', 'tui dung laptop', NULL, @cat_bags, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'tui dung laptop' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Đồ học tập', 'do hoc tap', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'do hoc tap' COLLATE utf8mb4_unicode_ci
);
SET @cat_study = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'do hoc tap' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Sách / vở', 'sach / vo', NULL, @cat_study, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'sach / vo' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Bút / thước', 'but / thuoc', NULL, @cat_study, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'but / thuoc' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Máy tính cầm tay', 'may tinh cam tay', NULL, @cat_study, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'may tinh cam tay' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Dụng cụ học tập', 'dung cu hoc tap', NULL, @cat_study, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'dung cu hoc tap' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Bình nước', 'binh nuoc', NULL, @cat_study, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'binh nuoc' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Quần áo & vật dụng cá nhân', 'quan ao & vat dung ca nhan', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'quan ao & vat dung ca nhan' COLLATE utf8mb4_unicode_ci
);
SET @cat_personal = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'quan ao & vat dung ca nhan' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Áo / khoác', 'ao / khoac', NULL, @cat_personal, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'ao / khoac' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Nón / mũ', 'non / mu', NULL, @cat_personal, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'non / mu' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Giày / dép', 'giay / dep', NULL, @cat_personal, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'giay / dep' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Ô / dù', 'o / du', NULL, @cat_personal, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'o / du' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Đồng hồ', 'dong ho', NULL, @cat_personal, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'dong ho' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Chìa khóa & thẻ', 'chia khoa & the', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'chia khoa & the' COLLATE utf8mb4_unicode_ci
);
SET @cat_keys = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'chia khoa & the' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Chìa khóa', 'chia khoa', NULL, @cat_keys, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'chia khoa' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Thẻ xe', 'the xe', NULL, @cat_keys, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'the xe' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Thẻ phòng', 'the phong', NULL, @cat_keys, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'the phong' COLLATE utf8mb4_unicode_ci
);
INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Móc khóa', 'moc khoa', NULL, @cat_keys, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'moc khoa' COLLATE utf8mb4_unicode_ci
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Khác', 'khac', NULL, NULL, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'khac' COLLATE utf8mb4_unicode_ci
);
SET @cat_other = (
  SELECT id FROM item_categories WHERE name_normalized = _utf8mb4'khac' COLLATE utf8mb4_unicode_ci LIMIT 1
);

INSERT INTO item_categories (id, name, name_normalized, icon, parent_id, sort_order)
SELECT UUID(), 'Vật dụng khác', 'vat dung khac', NULL, @cat_other, 0
WHERE NOT EXISTS (
  SELECT 1 FROM item_categories WHERE name_normalized = _utf8mb4'vat dung khac' COLLATE utf8mb4_unicode_ci
);
