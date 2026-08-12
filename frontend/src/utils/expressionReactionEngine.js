/**
 * Expression → Reaction mapping engine
 * ──────────────────────────────────────
 * Centralised config so expression-to-emoji logic is never
 * hardcoded across multiple components.
 *
 * Privacy note: expression classification runs locally on-device.
 * Raw camera frames are never sent to the backend for this feature.
 */

/** All 15 available in-call reactions */
export const ALL_REACTIONS = ["❤️","💕","🥰","😍","😘","😂","🤣","😡","😢","😮","👏","🔥","🎉","👍","✨"];

/** Expression → reaction pool mapping */
export const EXPRESSION_REACTION_MAP = {
  happy:     ["❤️", "💕", "✨", "😍"],
  laughing:  ["😂", "🤣", "🎉", "👏"],
  angry:     ["😡", "🔥"],
  sad:       ["😢", "💕", "😮"],
  surprised: ["😮", "✨", "🎉"],
  loving:    ["🥰", "❤️", "💕", "😘"],
  neutral:   [],  // no auto-effect for neutral
};

/**
 * Pick a random reaction emoji for a given expression type.
 * Returns null for neutral or unknown expressions.
 */
export function pickReactionForExpression(expressionType) {
  const pool = EXPRESSION_REACTION_MAP[expressionType] || [];
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Explosion particle emojis per reaction.
 * Used by ReactionExplosion component when a floating emoji is tapped.
 */
export const EXPLOSION_MAP = {
  "❤️": ["❤️","💕","💖","✨","❤️"],
  "💕": ["💕","❤️","💖","💗","✨"],
  "🥰": ["🥰","❤️","💕","😊","✨"],
  "😍": ["😍","❤️","✨","💕","😘"],
  "😘": ["😘","❤️","💕","🥰","✨"],
  "😂": ["😂","🤣","😂","✨","😂"],
  "🤣": ["🤣","😂","🤣","✨","😂"],
  "😡": ["😡","💥","😡","😡","💥"],
  "😢": ["😢","💧","😢","💧","😮"],
  "😮": ["😮","✨","😮","🎉","✨"],
  "👏": ["👏","👏","🎉","✨","👏"],
  "🔥": ["🔥","✨","🔥","💥","🔥"],
  "🎉": ["🎉","✨","🎉","👏","🎊"],
  "👍": ["👍","✨","👍","🎉","👍"],
  "✨": ["✨","💫","⭐","✨","💫"],
};

export function getExplosionParticles(emoji) {
  return EXPLOSION_MAP[emoji] || ["✨","✨","✨","✨","✨"];
}
