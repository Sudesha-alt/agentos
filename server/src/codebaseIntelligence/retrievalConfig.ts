/** Central thresholds for codebase vector retrieval (two-stage: permissive chunk fetch → file filter). */

export const RETRIEVAL_CHUNK_TOP_K = 40;
export const RETRIEVAL_WORK_FILES_TOP_N = 10;

/** Min similarity when fetching chunks from pgvector RPC */
export const CHUNK_FETCH_THRESHOLD = 0.55;

/** Include file in work list when aggregated score meets this */
export const FILE_PRESENT_THRESHOLD = 0.62;

/** High-confidence file hit */
export const FILE_HIGH_CONFIDENCE = 0.72;

/** Existing indexed file must meet this to be labeled `modify` */
export const FILE_WORK_THRESHOLD = 0.62;

/** Hybrid score weights */
export const SCORE_WEIGHTS = {
  semantic: 0.7,
  patternTag: 0.15,
  keyword: 0.1,
  headerChunk: 0.05,
} as const;

export const INCREMENTAL_INDEX_MAX_FILES = 50;
export const MAX_HEADER_ONLY_FILE_SIZE = 500 * 1024;
