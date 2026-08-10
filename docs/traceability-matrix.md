# Traceability Matrix

Last audit: 2026-08-01

This document links Business Rules, Requirements, and the canonical 100-UC set in `docs/Checklist/master-dev-checklist.md`. Each UC has exactly one primary owner.

| BR | Requirement | UC | Status |
| --- | --- | --- | --- |
| BR-01 | FR-AUTH-01, NFR-SEC-01 | UC-031, UC-032 | Implemented |
| BR-02 | FR-AUTH-02, NFR-SEC-01 | UC-033, UC-034, UC-035, UC-036 | Implemented |
| BR-03 | FR-ROLE-01, NFR-SEC-02 | UC-001, UC-002, UC-033, UC-062 | Implemented |
| BR-04 | FR-ROLE-01, FR-WAREHOUSE-01, FR-ADMIN-01 | UC-002, UC-059, UC-060, UC-062, UC-063, UC-066 | Partial |
| BR-05 | FR-BOARD-01, NFR-PERF-01 | UC-044, UC-046, UC-047 | Implemented |
| BR-06 | FR-POST-01 | UC-040, UC-041, UC-042, UC-043 | Implemented |
| BR-07 | FR-POST-01 | UC-040, UC-041 | Implemented |
| BR-08 | FR-POST-01, FR-HANDOVER-01 | UC-040, UC-041, UC-055, UC-058 | Implemented |
| BR-09 | FR-MEDIA-01, NFR-PRIV-01 | UC-048, UC-049, UC-050, UC-051, UC-087 | Implemented for MVP |
| BR-10 | FR-MEDIA-01, FR-CLAIM-01, NFR-PRIV-01, NFR-RT-01 | UC-049, UC-054, UC-078, UC-079, UC-083 | Implemented for MVP |
| BR-11 | FR-AI-01, FR-AI-02, FR-CLAIM-03, NFR-AI-01 | UC-070, UC-076, UC-089, UC-090, UC-092 | Implemented |
| BR-12 | FR-MATCH-01, FR-NOTI-01, NFR-PERF-01 | UC-068, UC-069, UC-070, UC-071, UC-072, UC-073, UC-076 | Implemented |
| BR-13 | FR-MATCH-01, FR-NOTI-01 | UC-073, UC-074, UC-083 | Implemented |
| BR-14 | FR-CLAIM-01 | UC-052, UC-053 | Implemented |
| BR-15 | FR-CLAIM-02, NFR-AUDIT-01 | UC-003, UC-004, UC-005, UC-006, UC-007 | Implemented |
| BR-16 | FR-CLAIM-03, NFR-AI-01 | UC-089, UC-090, UC-092 | Implemented |
| BR-17 | FR-HANDOVER-01 | UC-008, UC-009, UC-010, UC-055, UC-056, UC-057, UC-058 | Implemented |
| BR-18 | FR-WAREHOUSE-01, NFR-DATA-01, NFR-AUDIT-01 | UC-011, UC-012, UC-013, UC-014, UC-015, UC-059, UC-060 | Implemented |
| BR-19 | FR-WAREHOUSE-01, FR-WAREHOUSE-02 | UC-016, UC-017, UC-061 | Implemented |
| BR-20 | FR-WAREHOUSE-02, FR-NOTI-01 | UC-018, UC-019, UC-020 | Implemented for MVP |
| BR-21 | FR-APPT-01 | UC-021, UC-022, UC-023, UC-024 | Implemented |
| BR-22 | FR-RT-01, NFR-RT-01, NFR-SEC-02 | UC-077, UC-078, UC-079 | Implemented |
| BR-23 | FR-RT-01, NFR-RT-01 | UC-079, UC-080, UC-081, UC-082 | Implemented |
| BR-24 | FR-NOTI-01, NFR-PRIV-01 | UC-020, UC-073, UC-083 | Partial |
| BR-25 | FR-HANDOVER-01, FR-ADMIN-01, NFR-SEC-02 | UC-056, UC-063, UC-064, UC-065, UC-066, UC-067, UC-084, UC-085 | Partial |
| BR-26 | FR-REP-01, NFR-AI-01 | UC-025, UC-039 | Implemented |
| BR-27 | FR-AI-02, NFR-AI-01 | UC-026, UC-027, UC-028, UC-029, UC-030 | Partial foundation |
| BR-28 | FR-MOBILE-01, NFR-SEC-02, NFR-RT-01 | UC-093, UC-094, UC-095, UC-096, UC-097, UC-098, UC-099, UC-100 | Partial |
| BR-29 | FR-DEMO-01 | UC-031, UC-032, UC-040, UC-041, UC-059 | Implemented |
| BR-30 | NFR-AUDIT-01, NFR-DATA-01, NFR-PERF-01, NFR-RT-01, NFR-PRIV-01 | UC-007, UC-015, UC-054, UC-071, UC-078, UC-089 | Core smoke implemented; browser/load hardening pending |
| BR-31 | FR-AI-03, FR-CLAIM-01, FR-CLAIM-03, NFR-AI-01, NFR-AI-02 | UC-049, UC-052, UC-054, UC-089, UC-090, UC-092 | Implemented for MVP |
| BR-32 | FR-AI-04, FR-NOTI-01, NFR-AI-02, NFR-PRIV-01 | UC-067, UC-073, UC-083, UC-084, UC-085 | Implemented for MVP |
| BR-33 | FR-AI-05, FR-MATCH-01, NFR-AI-01, NFR-AI-02 | UC-059, UC-070, UC-076, UC-084, UC-086, UC-091 | Implemented for MVP |
| BR-34 | FR-AI-03, FR-AI-04, FR-AI-05, FR-ADMIN-01, NFR-SEC-02 | UC-062, UC-066, UC-070, UC-084, UC-085 | Implemented |

## UC Count

| Metric | Value |
| --- | --- |
| Total canonical UC | 100 |
| Lowest UC | UC-001 |
| Highest UC | UC-100 |
| Deprecated old UC above UC-100 | Not used |

## Private Assistance Traceability (2026-08-03)

| Business rule | Requirements | Use cases | Evidence |
| --- | --- | --- | --- |
| BR-35 | FR-CLAIM-09, NFR-PRIV-01, NFR-SEC-01 | UC-045, UC-048, UC-049, UC-054 | Migrations 034-035, `proof-vault.*`, authenticated media proxy, private-assistance E2E |
| BR-36 | FR-CLAIM-09, NFR-DATA-01 | UC-048, UC-049, UC-054 | Transactional attach, proof row lock, archive-safe claim snapshot |
| BR-37 | FR-POST-07, NFR-PRIV-01 | UC-020, UC-022, UC-023, UC-076 | Backend serializer tests, generic private match notification |
| BR-38 | FR-AI-06, FR-CLAIM-10, NFR-AI-01, NFR-AI-02 | UC-049, UC-054, UC-070, UC-076, UC-089 | OCR redaction tests, reviewer-only map, feature flags |

## User Recovery Assistance Traceability (2026-08-03)

| Business rule | Requirements | Use cases | Evidence |
| --- | --- | --- | --- |
| BR-39 | FR-AI-07, FR-MATCH-01, NFR-AI-01, NFR-PRIV-01 | UC-040, UC-041, UC-068, UC-070, UC-076 | Migration 036, `search-companion.*`, advisory preview tests, owner/active-LOST guards |
| BR-40 | FR-POST-08, FR-AI-01, FR-MATCH-01, NFR-AI-01, NFR-AI-02 | UC-040, UC-041, UC-068, UC-070, UC-076, UC-086 | Migration 036, `finder-quick-scan.*`, media/Safe Search tests, terminal-session regression and locked idempotent publish |
| BR-41 | FR-RECOVERY-01, FR-NOTI-01, NFR-PRIV-01, NFR-AUDIT-01 | UC-021, UC-024, UC-045, UC-052, UC-054, UC-059, UC-073 | Migration 036, `recovery-timeline.*`, authorization query and privacy unit tests |

Migrations 035-036 have a schema regression test proving all seven assistance flags default to disabled until release gates pass.
