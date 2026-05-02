/**
 * moodParser.ts — maps freeform text keywords to mood tags used by the
 * recommendation engine. No external dependencies.
 */

const MOOD_KEYWORD_MAP: Record<string, string> = {
  // Happy / Laugh
  happy: 'Laugh',
  excited: 'Laugh',
  joy: 'Laugh',
  fun: 'Laugh',
  funny: 'Laugh',
  cheerful: 'Laugh',
  upbeat: 'Laugh',
  silly: 'Laugh',
  goofy: 'Laugh',
  playful: 'Laugh',

  // Cry / Emotional
  sad: 'Cry',
  cry: 'Cry',
  emotional: 'Cry',
  heartbroken: 'Cry',
  melancholy: 'Cry',
  down: 'Cry',
  blue: 'Cry',
  grief: 'Cry',
  lonely: 'Cry',
  miss: 'Cry',

  // Think / Intellectual
  curious: 'Think',
  think: 'Think',
  intellectual: 'Think',
  thoughtful: 'Think',
  philosophical: 'Think',
  wondering: 'Think',
  analytical: 'Think',
  complex: 'Think',
  deep: 'Think',
  smart: 'Think',

  // Escape / Relax
  bored: 'Escape',
  tired: 'Escape',
  stressed: 'Escape',
  relax: 'Escape',
  chill: 'Escape',
  unwind: 'Escape',
  escape: 'Escape',
  distract: 'Escape',
  mindless: 'Escape',
  easy: 'Escape',
  lazy: 'Escape',

  // Be Scared / Thrilled
  scared: 'Be Scared',
  scary: 'Be Scared',
  thrilled: 'Be Scared',
  horror: 'Be Scared',
  creepy: 'Be Scared',
  spooky: 'Be Scared',
  adrenaline: 'Be Scared',
  tense: 'Be Scared',
  thriller: 'Be Scared',

  // Be Inspired
  inspired: 'Be Inspired',
  motivated: 'Be Inspired',
  hopeful: 'Be Inspired',
  uplifted: 'Be Inspired',
  amazing: 'Be Inspired',
  awe: 'Be Inspired',
  triumphant: 'Be Inspired',
  moving: 'Be Inspired',

  // Feel Something
  numb: 'Feel Something',
  empty: 'Feel Something',
  disconnected: 'Feel Something',
  weird: 'Feel Something',
  strange: 'Feel Something',
  restless: 'Feel Something',
}

/**
 * Parses freeform mood text and returns an array of unique mood tags.
 * Example: "I'm tired and stressed" → ["Escape"]
 */
export function parseMoodText(text: string): string[] {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)
  const matched = new Set<string>()
  for (const word of words) {
    if (MOOD_KEYWORD_MAP[word]) {
      matched.add(MOOD_KEYWORD_MAP[word])
    }
  }
  return Array.from(matched)
}

/**
 * Generates a survey hash string for use as a TanStack Query key.
 * Ensures the same survey inputs always map to the same cache entry.
 */
export function hashSurvey(survey: object): string {
  return JSON.stringify(survey, Object.keys(survey).sort())
}
