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

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Max files per incremental batch before queuing another batch run */
export const INCREMENTAL_INDEX_BATCH_SIZE = envInt("INCREMENTAL_INDEX_BATCH_SIZE", 50);

/** Total files above which we still use batched incremental (not full re-index) */
export const INCREMENTAL_INDEX_MAX_FILES = envInt("INCREMENTAL_INDEX_MAX_FILES", 500);

export const MAX_HEADER_ONLY_FILE_SIZE = 500 * 1024;

/** Cursor-style AST chunking: ~2048 token budget (chars ≈ tokens × 4). */
export const CODEBASE_CHUNK_MAX_TOKENS = envInt("CODEBASE_CHUNK_MAX_TOKENS", 2048);

const DEFAULT_CHUNK_MAX_CHARS = CODEBASE_CHUNK_MAX_TOKENS * 4;

/** Max span size in characters; defaults to token budget × 4 unless overridden. */
export const CODEBASE_CHUNK_MAX_CHARS = envInt(
  "CODEBASE_CHUNK_MAX_CHARS",
  DEFAULT_CHUNK_MAX_CHARS
);

/** Skip tiny spans (whitespace-only gaps) */
export const CODEBASE_CHUNK_MIN_CHARS = envInt("CODEBASE_CHUNK_MIN_CHARS", 40);

/** Hard cap per file including header chunk */
export const CODEBASE_MAX_CHUNKS_PER_FILE = envInt("CODEBASE_MAX_CHUNKS_PER_FILE", 16);

/** Embedding API input cap (span + FILE/SPAN header lines). */
export const CODEBASE_EMBEDDING_INPUT_MAX_CHARS =
  CODEBASE_CHUNK_MAX_CHARS + 512;

/** Enriched codebase context pipeline */
export const CONTEXT_SQL_TOP_N = envInt("CODEBASE_CONTEXT_SQL_TOP_N", 12);
export const CONTEXT_GRAPH_DEPTH = envInt("CODEBASE_CONTEXT_GRAPH_DEPTH", 1);
export const CONTEXT_GQL_MAX_FILES = envInt("CODEBASE_CONTEXT_GQL_MAX_FILES", 8);
export const CONTEXT_CONTENT_PREVIEW_CHARS = 4000;

/** Ticket vector retrieval */
export const TICKET_CHUNK_FETCH_TOP_K = 48;
export const TICKET_AGGREGATE_TOP_N = 10;
export const TICKET_CHUNK_FETCH_THRESHOLD = 0.55;
export const TICKET_PRESENT_THRESHOLD = 0.62;
export const TICKET_HIGH_CONFIDENCE = 0.72;
export const TICKET_JQL_BOOST = 0.12;
export const TICKET_COMPONENT_BOOST = 0.05;

export const TICKET_RETRIEVAL_CONFIGS = {
  PM_AGENT: { topK: 10, similarityThreshold: 0.62 },
  PRODUCT_AGENT: { topK: 8, similarityThreshold: 0.65 },
  ENGINEERING_AGENT: { topK: 6, similarityThreshold: 0.68 },
  QA_AGENT: { topK: 6, similarityThreshold: 0.65 },
  IMPLEMENTATION_CONTEXT: { topK: 5, similarityThreshold: 0.6 },
} as const;
