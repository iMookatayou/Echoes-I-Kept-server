import { z } from 'zod'

// express.json() caps the whole body at 1mb, which is far too loose for a
// prompt — every character here becomes billable input tokens. These caps are
// the real limit; 20k characters is well beyond any plausible blog post.
const draftContent = z.string().trim().min(1).max(20_000)
const shortField = z.string().trim().max(240)

// Covers the whole authoring form, not just the body — a typo in the title
// or introduction is just as worth catching as one in the content.
export const polishSchema = z.object({
  content: draftContent,
  title: shortField.default(''),
  description: shortField.default(''),
})

// Runs before the post exists, so — unlike moderateSchema below — this takes
// the draft directly from the client rather than reading a stored row.
// Combines a readiness check with first-reader feedback in one call.
export const presubmitCheckSchema = z.object({
  content: draftContent,
  title: shortField.default(''),
  artist: shortField.default(''),
  bestPick: shortField.default(''),
  description: shortField.default(''),
})

// Only the post id — the server reads the post itself rather than trusting a
// body the client could have rewritten. An admin must be shown the analysis
// of what is actually stored, not of text the submitter supplied twice.
export const moderateSchema = z.object({
  postId: z.coerce.number().int().positive(),
})
