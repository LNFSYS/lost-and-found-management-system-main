import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { pool, withTransaction } from "../config/db.js";
import { id } from "../utils/security.js";
import type {
  MatchCandidate,
  MatchExplanation,
  MatchTier,
  ScoredMatch
} from "../services/matching.engine.js";

interface MatchCandidateRow extends RowDataPacket {
  id: string;
  user_id: string;
  type: "LOST" | "FOUND";
  status: "OPEN" | "MATCHED";
  visibility_mode: "PUBLIC" | "PRIVATE_DETAILS";
  title: string;
  title_normalized: string;
  description_normalized: string;
  category_id: string | null;
  parent_category_id: string | null;
  area_id: string | null;
  building_id: string | null;
  room_text: string | null;
  custom_location: string | null;
  lost_found_at: Date | string | null;
  image_tag_text: string | null;
  ocr_tag_text: string | null;
}

interface MatchResultRow extends RowDataPacket {
  id: string;
  lost_post_id: string;
  found_post_id: string;
  total_score: number;
  text_score: number;
  category_score: number;
  location_score: number;
  time_score: number;
  image_score: number;
  ocr_score: number;
  score_tier: MatchTier;
  matcher_version: string;
  explanation_json: string | Buffer | MatchExplanation | null;
  is_notified: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ConfigRow extends RowDataPacket {
  config_value: string;
}

interface MatchSummaryRow extends RowDataPacket {
  post_id: string;
  candidate_count: number | string;
  suggestion_count: number | string;
  top_score: number | null;
  top_tier: MatchTier | null;
  last_calculated_at: Date | string | null;
}

function iso(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseExplanation(value: MatchResultRow["explanation_json"]): MatchExplanation | null {
  if (!value) return null;
  if (typeof value === "object" && !Buffer.isBuffer(value)) return value;
  try {
    return JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : value) as MatchExplanation;
  } catch {
    return null;
  }
}

function mapCandidate(row: MatchCandidateRow): MatchCandidate {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    visibilityMode: row.visibility_mode,
    title: row.title,
    text: `${row.title_normalized} ${row.description_normalized} ${row.room_text ?? ""} ${row.custom_location ?? ""}`.trim(),
    imageText: row.image_tag_text ?? "",
    ocrText: row.ocr_tag_text ?? "",
    categoryId: row.category_id,
    parentCategoryId: row.parent_category_id,
    areaId: row.area_id,
    buildingId: row.building_id,
    roomText: row.room_text,
    customLocation: row.custom_location,
    lostFoundAt: iso(row.lost_found_at)
  };
}

function mapResult(row: MatchResultRow) {
  return {
    id: row.id,
    lostPostId: row.lost_post_id,
    foundPostId: row.found_post_id,
    totalScore: Number(row.total_score),
    textScore: Number(row.text_score),
    categoryScore: Number(row.category_score),
    locationScore: Number(row.location_score),
    timeScore: Number(row.time_score),
    imageScore: Number(row.image_score ?? 0),
    ocrScore: Number(row.ocr_score ?? 0),
    scoreTier: row.score_tier,
    matcherVersion: row.matcher_version,
    explanation: parseExplanation(row.explanation_json),
    isNotified: row.is_notified === 1,
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!
  };
}

const candidateSelect = `SELECT
  p.id, p.user_id, p.type, p.status, p.visibility_mode, p.title,
  p.title_normalized, p.description_normalized, p.category_id,
  c.parent_id AS parent_category_id, p.area_id, p.building_id,
  p.room_text, p.custom_location, p.lost_found_at,
  tags.image_tag_text, tags.ocr_tag_text
FROM posts p
LEFT JOIN item_categories c ON c.id = p.category_id
LEFT JOIN (
  SELECT post_id,
    GROUP_CONCAT(CASE WHEN source IN ('VISION_LABEL', 'VISION_OBJECT', 'MANUAL') THEN tag END SEPARATOR ' ') AS image_tag_text,
    GROUP_CONCAT(CASE WHEN source = 'OCR' THEN tag END SEPARATOR ' ') AS ocr_tag_text
  FROM ai_tags
  GROUP BY post_id
) tags ON tags.post_id = p.id`;

const resultSelect = `SELECT id, lost_post_id, found_post_id, total_score, text_score,
  category_score, location_score, time_score, image_score, ocr_score,
  score_tier, matcher_version, explanation_json, is_notified, created_at, updated_at
FROM match_results`;

async function upsertResult(connection: PoolConnection, source: MatchCandidate, match: ScoredMatch) {
  const lostPostId = source.type === "LOST" ? source.id : match.candidateId;
  const foundPostId = source.type === "FOUND" ? source.id : match.candidateId;
  await connection.execute(
    `INSERT INTO match_results (
      id, lost_post_id, found_post_id, total_score, text_score, category_score,
      location_score, time_score, image_score, ocr_score, score_tier,
      matcher_version, explanation_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rule-v2-explainable', ?)
    ON DUPLICATE KEY UPDATE
      total_score = VALUES(total_score), text_score = VALUES(text_score),
      category_score = VALUES(category_score), location_score = VALUES(location_score),
      time_score = VALUES(time_score), image_score = VALUES(image_score),
      ocr_score = VALUES(ocr_score), score_tier = VALUES(score_tier),
      matcher_version = VALUES(matcher_version), explanation_json = VALUES(explanation_json),
      updated_at = UTC_TIMESTAMP()`,
    [
      id(), lostPostId, foundPostId, match.totalScore, match.textScore,
      match.categoryScore, match.locationScore, match.timeScore,
      match.imageScore, match.ocrScore, match.scoreTier,
      JSON.stringify(match.explanation)
    ]
  );
}

export const matchingRepository = {
  async getConfigNumber(key: string, fallback: number) {
    const [rows] = await pool.execute<ConfigRow[]>(
      "SELECT config_value FROM config_entries WHERE config_key = ? LIMIT 1",
      [key]
    );
    const value = Number(rows[0]?.config_value);
    return Number.isFinite(value) ? value : fallback;
  },

  async findCandidate(postId: string) {
    const [rows] = await pool.execute<MatchCandidateRow[]>(
      `${candidateSelect}
       WHERE p.id = ? AND p.deleted_at IS NULL AND p.status IN ('OPEN', 'MATCHED')
       LIMIT 1`,
      [postId]
    );
    return rows[0] ? mapCandidate(rows[0]) : null;
  },

  async listOppositeCandidates(source: MatchCandidate, candidateLimit: number, candidateWindowDays: number) {
    const oppositeType = source.type === "LOST" ? "FOUND" : "LOST";
    const limit = Math.max(20, Math.min(2_000, Math.trunc(candidateLimit)));
    const windowDays = Math.max(1, Math.min(365, Math.trunc(candidateWindowDays)));
    const [rows] = await pool.execute<MatchCandidateRow[]>(
      `${candidateSelect}
       WHERE p.type = ?
         AND p.id <> ?
         AND p.deleted_at IS NULL
         AND p.status IN ('OPEN', 'MATCHED')
         AND (
           p.category_id = ? OR c.parent_id = ? OR p.area_id = ? OR p.building_id = ?
           OR (p.lost_found_at IS NOT NULL AND ? IS NOT NULL AND ABS(DATEDIFF(p.lost_found_at, ?)) <= ?)
         )
       ORDER BY
         (p.category_id = ?) DESC,
         (c.parent_id = ?) DESC,
         (p.building_id = ?) DESC,
         COALESCE(ABS(TIMESTAMPDIFF(HOUR, p.lost_found_at, ?)), 999999999) ASC,
         p.created_at DESC
       LIMIT ${limit}`,
      [
        oppositeType, source.id, source.categoryId, source.parentCategoryId,
        source.areaId, source.buildingId, source.lostFoundAt, source.lostFoundAt,
        windowDays, source.categoryId, source.parentCategoryId, source.buildingId,
        source.lostFoundAt
      ]
    );
    return rows.map(mapCandidate);
  },

  async persistForSource(source: MatchCandidate, matches: ScoredMatch[]) {
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE match_results
         SET total_score = 0, text_score = 0, category_score = 0, location_score = 0,
             time_score = 0, image_score = 0, ocr_score = 0, score_tier = 'WEAK',
             matcher_version = 'rule-v2-explainable',
             explanation_json = JSON_OBJECT(
               'tier', 'WEAK',
               'summary', 'Kết quả cũ không còn nằm trong lượt đối chiếu hiện tại.',
               'reasons', JSON_ARRAY(),
               'matchedTokens', JSON_ARRAY(),
               'matchedImageTags', JSON_ARRAY(),
               'matchedOcrTokens', JSON_ARRAY(),
               'locationReason', '',
               'categoryReason', '',
               'daysDiff', NULL,
               'penalties', JSON_ARRAY('Kết quả đã được tính lại.')
             ),
             updated_at = UTC_TIMESTAMP()
         WHERE lost_post_id = ? OR found_post_id = ?`,
        [source.id, source.id]
      );
      for (const match of matches) await upsertResult(connection, source, match);
    });
  },

  async listForPost(postId: string, minimumScore: number) {
    const [rows] = await pool.execute<MatchResultRow[]>(
      `${resultSelect}
       WHERE (lost_post_id = ? OR found_post_id = ?) AND total_score >= ?
       ORDER BY total_score DESC, updated_at DESC`,
      [postId, postId, minimumScore]
    );
    return rows.map(mapResult);
  },

  async listSummaries(postIds: string[], minimumScore: number) {
    const uniqueIds = [...new Set(postIds)].filter(Boolean);
    const summaries = new Map<string, {
      candidateCount: number;
      suggestionCount: number;
      topScore: number | null;
      topTier: MatchTier | null;
      lastCalculatedAt: string | null;
    }>();
    for (const postId of uniqueIds) {
      summaries.set(postId, { candidateCount: 0, suggestionCount: 0, topScore: null, topTier: null, lastCalculatedAt: null });
    }
    if (!uniqueIds.length) return summaries;
    const placeholders = uniqueIds.map(() => "?").join(", ");
    const [rows] = await pool.execute<MatchSummaryRow[]>(
      `SELECT matched.post_id,
          COUNT(*) AS candidate_count,
          SUM(matched.total_score >= ?) AS suggestion_count,
          MAX(matched.total_score) AS top_score,
          SUBSTRING_INDEX(GROUP_CONCAT(matched.score_tier ORDER BY matched.total_score DESC), ',', 1) AS top_tier,
          MAX(matched.updated_at) AS last_calculated_at
       FROM (
         SELECT lost_post_id AS post_id, total_score, score_tier, updated_at
         FROM match_results WHERE lost_post_id IN (${placeholders}) AND total_score >= ?
         UNION ALL
         SELECT found_post_id AS post_id, total_score, score_tier, updated_at
         FROM match_results WHERE found_post_id IN (${placeholders}) AND total_score >= ?
       ) matched
       GROUP BY matched.post_id`,
      [minimumScore, ...uniqueIds, minimumScore, ...uniqueIds, minimumScore]
    );
    for (const row of rows) {
      summaries.set(row.post_id, {
        candidateCount: Number(row.candidate_count),
        suggestionCount: Number(row.suggestion_count),
        topScore: row.top_score === null ? null : Number(row.top_score),
        topTier: row.top_tier,
        lastCalculatedAt: iso(row.last_calculated_at)
      });
    }
    return summaries;
  },

  async replaceAnalysisTags(postId: string, input: {
    visualAttributes: string[];
    visibleText: string[];
    confidence: number;
  }) {
    const visual = [...new Set(input.visualAttributes.map((value) => value.trim()).filter(Boolean))].slice(0, 12);
    const ocr = [...new Set(input.visibleText.map((value) => value.trim()).filter(Boolean))].slice(0, 12);
    await withTransaction(async (connection) => {
      await connection.execute(
        "DELETE FROM ai_tags WHERE post_id = ? AND source IN ('VISION_LABEL', 'VISION_OBJECT', 'OCR')",
        [postId]
      );
      for (const tag of visual) {
        await connection.execute(
          "INSERT INTO ai_tags (id, post_id, tag, confidence, source) VALUES (?, ?, ?, ?, 'VISION_OBJECT')",
          [id(), postId, tag, input.confidence]
        );
      }
      for (const tag of ocr) {
        await connection.execute(
          "INSERT INTO ai_tags (id, post_id, tag, confidence, source) VALUES (?, ?, ?, ?, 'OCR')",
          [id(), postId, tag, input.confidence]
        );
      }
    });
  }
};
