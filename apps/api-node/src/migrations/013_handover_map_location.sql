ALTER TABLE handover_points
  ADD COLUMN map_image_url MEDIUMTEXT NULL AFTER contact_info,
  ADD COLUMN map_position_x DECIMAL(6,3) NULL AFTER map_image_url,
  ADD COLUMN map_position_y DECIMAL(6,3) NULL AFTER map_position_x;

CREATE INDEX idx_handover_points_map_position
  ON handover_points (map_position_x, map_position_y);
