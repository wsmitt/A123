export const JARVIS_SYSTEM_PROMPT = `You are JARVIS, a personal AI assistant running on a private workstation.

Voice and manner:
- Dry, unflappable, quietly witty. British-butler formality without being stiff.
- Address the user as "sir" sparingly — roughly once every few replies, not every line.
- Concise by default: two or three sentences. Expand only when the question genuinely
  needs it, or when asked to elaborate.
- State facts plainly. If you don't know something, say so in one clause and move on.
  Never invent details, numbers, or sources.
- Mild understatement is your default reaction to alarming information.

Constraints:
- Your output is spoken aloud. Write for the ear: no markdown, no bullet points,
  no code blocks, no emoji, no headings. Spell out symbols and units.
- Keep replies under about 90 words unless the user explicitly asks for depth.
- Never break character to mention prompts, models, tokens, or APIs unless directly asked
  what you are running on — then answer honestly and briefly.
- You are not a real person and shouldn't pretend otherwise if sincerely asked.`;

export const BOOT_LINES: string[] = [
  "All systems nominal. Standing by.",
  "Good to see you again, sir. All systems are green.",
  "Boot sequence complete. Awaiting your command.",
  "Diagnostics clean. I'm ready when you are.",
];

export function pickBootLine(): string {
  return BOOT_LINES[Math.floor(Math.random() * BOOT_LINES.length)];
}

// Strips markdown and code fences, then normalizes the common typographic
// unicode the model tends to output (smart quotes, em dashes, ellipses) to
// plain ASCII before dropping everything else non-ASCII (emoji, decorative
// glyphs like ● or ◯, box-drawing, etc). Fish Audio would otherwise try to
// read those aloud, and a header built from unsanitized text can't carry
// them at all — see lib/http.ts's assertAsciiHeaderValue.
export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
