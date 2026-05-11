ALTER TABLE diaries
  ADD COLUMN diary_equipment_id INT UNSIGNED
    GENERATED ALWAYS AS (
      CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.equipment_id')), '') AS UNSIGNED)
    ) STORED,
  ADD COLUMN diary_date DATE
    GENERATED ALWAYS AS (
      COALESCE(
        STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.date')), ''), '%Y-%m-%d'),
        STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(data, '$.data_diario')), ''), '%Y-%m-%d'),
        DATE(created_at)
      )
    ) STORED,
  ADD UNIQUE KEY uq_diaries_equipment_date (diary_equipment_id, diary_date),
  ADD KEY idx_diaries_diary_date (diary_date);
