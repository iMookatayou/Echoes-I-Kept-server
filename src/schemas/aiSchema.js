import { z } from 'zod'

// express.json() caps the whole body at 1mb, which is far too loose for a
// prompt — every character here becomes billable input tokens. This is the
// ceiling for anything sent to the model on any path; 20k characters is well
// beyond any plausible post about a song.
//
// Unlike the fields below, this deliberately does *not* mirror postSchema,
// where `content` has no maximum at all. A post longer than this stays
// publishable but can't be run through /polish or /presubmit-check, which is
// the accepted trade for a hard cost ceiling on a per-token API. The moderate
// endpoint reads stored rows rather than a request body, so it truncates to
// this instead of rejecting — see aiController.
export const AI_INPUT_MAX_CHARS = 20_000

const draftContent = z.string().trim().min(1).max(AI_INPUT_MAX_CHARS)

// These two do mirror postSchema.contentFieldsSchema exactly — 240 for
// title/artist/bestPick, 2000 for description — because for short fields
// there's no cost argument for diverging, and a mismatch would mean text a
// member can publish but not run the assistant over.
const titleField = z.string().trim().max(240)
const descriptionField = z.string().trim().max(2000)

// Covers the whole authoring form, not just the body — a typo in the title
// or introduction is just as worth catching as one in the content.
export const polishSchema = z.object({
  content: draftContent,
  title: titleField.default(''),
  description: descriptionField.default(''),
})

// Runs before the post exists, so — unlike moderateSchema below — this takes
// the draft directly from the client rather than reading a stored row.
// Combines a readiness check with first-reader feedback in one call.
export const presubmitCheckSchema = z.object({
  content: draftContent,
  title: titleField.default(''),
  artist: titleField.default(''),
  bestPick: titleField.default(''),
  description: descriptionField.default(''),
})

// Only the post id — the server reads the post itself rather than trusting a
// body the client could have rewritten. An admin must be shown the analysis
// of what is actually stored, not of text the submitter supplied twice.
export const moderateSchema = z.object({
  postId: z.coerce.number().int().positive(),
})

// Reader-facing, unlike the schemas above — reads the stored post rather
// than trusting client-supplied text, same reasoning as moderateSchema.
export const translateSchema = z.object({
  postId: z.coerce.number().int().positive(),
  targetLanguage: z.enum(['en', 'th']),
})
