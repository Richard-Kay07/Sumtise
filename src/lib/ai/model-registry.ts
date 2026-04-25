/**
 * OpenAI Model Registry
 *
 * Three concerns solved here:
 *
 * 1. ALWAYS LATEST — on first use, fetches the live model list from OpenAI,
 *    sorts by `created` timestamp, and picks the newest model that matches
 *    each tier's preference order. Refreshes every 6 hours.
 *
 * 2. TIER ABSTRACTION — callers ask for FAST / SMART / VISION / REASONING.
 *    The registry maps tiers to actual model IDs. Hardcoded fallbacks mean
 *    the system keeps working even if the API call fails.
 *
 * 3. USER SWITCHING — `resolveModels()` returns a full snapshot including
 *    all available models and the resolved tier assignments. The AI router
 *    exposes this via `getModels`. The UI lets users pick a tier preference
 *    which overrides the default per-operation tier at call time.
 */

import OpenAI from "openai"

export type ModelTier = "FAST" | "SMART" | "VISION" | "REASONING"

export interface TierResolution {
  tier: ModelTier
  modelId: string
  displayName: string
  description: string
}

export interface ModelSnapshot {
  tiers: Record<ModelTier, TierResolution>
  allModels: Array<{ id: string; created: number; family: string }>
  resolvedAt: Date
  source: "live" | "fallback"
}

// ── Tier definitions ─────────────────────────────────────────────────────────
//
// Each tier lists model IDs in preference order (newest / best first).
// The registry picks the first ID that actually exists in the live model list.
// If none match, the first entry is used as a hardcoded fallback.

const TIER_PREFERENCES: Record<ModelTier, string[]> = {
  // Cheap + fast: intent classification, structured extraction from text
  FAST: [
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o-mini",
    "gpt-3.5-turbo",
  ],
  // Best quality: narrative synthesis, insights, general chat
  SMART: [
    "gpt-4.1",
    "gpt-4o",
    "gpt-4-turbo",
    "gpt-4",
  ],
  // Multimodal (image understanding): receipt OCR fallback
  VISION: [
    "gpt-4.1",
    "gpt-4o",
    "gpt-4-vision-preview",
  ],
  // Chain-of-thought reasoning: anomaly analysis, complex financial queries
  REASONING: [
    "o3-mini",
    "o1-mini",
    "o1",
    "gpt-4.1",
    "gpt-4o",
  ],
}

const TIER_DESCRIPTIONS: Record<ModelTier, { displayName: string; description: string }> = {
  FAST:      { displayName: "Fast",      description: "Low latency, low cost — best for quick lookups" },
  SMART:     { displayName: "Smart",     description: "Highest accuracy — best for complex analysis" },
  VISION:    { displayName: "Vision",    description: "Image understanding — required for receipt scanning" },
  REASONING: { displayName: "Reasoning", description: "Deep chain-of-thought — best for anomaly detection" },
}

// ── In-process cache ─────────────────────────────────────────────────────────

const CACHE_TTL_MS = 6 * 60 * 60 * 1000  // 6 hours
let cachedSnapshot: ModelSnapshot | null = null

// ── Helpers ──────────────────────────────────────────────────────────────────

function modelFamily(id: string): string {
  if (id.startsWith("gpt-4.1"))    return "GPT-4.1"
  if (id.startsWith("gpt-4o"))     return "GPT-4o"
  if (id.startsWith("gpt-4-turbo"))return "GPT-4 Turbo"
  if (id.startsWith("gpt-4"))      return "GPT-4"
  if (id.startsWith("gpt-3.5"))    return "GPT-3.5"
  if (id.startsWith("o3"))         return "o3"
  if (id.startsWith("o1"))         return "o1"
  return "Other"
}

function isUsableModel(id: string): boolean {
  // Exclude fine-tuned, embeddings, image gen, whisper, tts
  const exclude = ["embed", "dall-e", "whisper", "tts", "babbage", "davinci", "curie", "ada"]
  return !exclude.some(ex => id.includes(ex))
}

function pickBestForTier(
  tier: ModelTier,
  available: Set<string>
): string {
  const prefs = TIER_PREFERENCES[tier]
  for (const modelId of prefs) {
    if (available.has(modelId)) return modelId
  }
  // No exact match — try prefix matching for versioned aliases
  // e.g. "gpt-4.1" matches "gpt-4.1-2025-04-14"
  for (const preferred of prefs) {
    const prefixMatch = [...available].find(m => m.startsWith(preferred))
    if (prefixMatch) return prefixMatch
  }
  // Hardcoded fallback (first preference, used even if not in list)
  return prefs[0]
}

// ── Core resolver ─────────────────────────────────────────────────────────────

async function fetchLiveModels(openai: OpenAI): Promise<Array<{ id: string; created: number }>> {
  const page = await openai.models.list()
  return page.data
    .filter(m => isUsableModel(m.id))
    .sort((a, b) => b.created - a.created)
}

export async function resolveModels(openai: OpenAI): Promise<ModelSnapshot> {
  // Return cached snapshot if still fresh
  if (cachedSnapshot && (Date.now() - cachedSnapshot.resolvedAt.getTime()) < CACHE_TTL_MS) {
    return cachedSnapshot
  }

  let liveModels: Array<{ id: string; created: number }> = []
  let source: "live" | "fallback" = "fallback"

  try {
    liveModels = await fetchLiveModels(openai)
    source = "live"
  } catch {
    // OpenAI models.list() failed — use hardcoded fallbacks, still functional
  }

  const availableIds = new Set(liveModels.map(m => m.id))

  const tiers = (Object.keys(TIER_PREFERENCES) as ModelTier[]).reduce((acc, tier) => {
    const modelId = pickBestForTier(tier, availableIds)
    acc[tier] = {
      tier,
      modelId,
      ...TIER_DESCRIPTIONS[tier],
    }
    return acc
  }, {} as Record<ModelTier, TierResolution>)

  const snapshot: ModelSnapshot = {
    tiers,
    allModels: liveModels.slice(0, 30).map(m => ({
      id: m.id,
      created: m.created,
      family: modelFamily(m.id),
    })),
    resolvedAt: new Date(),
    source,
  }

  cachedSnapshot = snapshot
  return snapshot
}

// ── Convenience getter ────────────────────────────────────────────────────────

/**
 * Returns the model ID to use for a given tier, using the cached snapshot.
 * If no snapshot exists yet, returns the hardcoded first-preference for that tier.
 *
 * Call `resolveModels()` first for accurate live resolution.
 */
export function getModelId(tier: ModelTier, override?: string): string {
  if (override) return override
  if (cachedSnapshot) return cachedSnapshot.tiers[tier].modelId
  return TIER_PREFERENCES[tier][0]  // safe hardcoded default
}

/** Force-invalidate the cache (useful in tests or after config change) */
export function invalidateModelCache() {
  cachedSnapshot = null
}
