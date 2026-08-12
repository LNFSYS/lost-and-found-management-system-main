UPDATE matching_jobs
SET available_at = UTC_TIMESTAMP(),
    locked_at = NULL,
    status = IF(status = 'PROCESSING', 'PENDING', status)
WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
  AND processed_version < requested_version;
