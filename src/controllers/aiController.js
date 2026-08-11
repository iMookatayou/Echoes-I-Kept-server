import { Type } from '@google/genai'
import { z } from 'zod'
import { AI_MODEL, gemini, hasGeminiConfig } from '../geminiClient.js'
import {
  consumeGlobalQuota,
  consumeQuota,
  refundGlobalQuota,
  refundQuota,
} from '../repositories/aiUsageRepository.js'
import { getCachedTranslation, saveTranslation } from '../repositories/postTranslationsRepository.js'
import { getPostById } from '../repositories/postsRepository.js'
import { AI_INPUT_MAX_CHARS } from '../schemas/aiSchema.js'
import {
  MODERATE_SYSTEM,
  POLISH_SYSTEM,
  PRESUBMIT_SYSTEM,
  buildModerateUserMessage,
  buildPolishUserMessage,
  buildPresubmitUserMessage,
  buildTranslateSystem,
  buildTranslateUserMessage,
} from '../utils/aiPrompts.js'
import { HttpError } from '../utils/httpError.js'

// Gemini's free tier caps requests per project per model per day, shared
// across every user and all three of these endpoints combined — confirmed
// live at just 20/day for "gemini-flash-latest" (whatever full-size flash
// model that currently resolves to). AI_MODEL has since moved to
// "gemini-flash-lite-latest" for a presumably larger free allowance (lite
// tiers are priced for higher volume), but that number isn't independently
// confirmed — Google no longer publishes per-model free-tier limits in its
// docs, only in the account's own dashboard. GLOBAL_DAILY_LIMIT stays
// conservative until that's checked, so the app refuses with a clear message
// before Google's own 429 does rather than assuming headroom that may not
// exist. Per-user limits are small fractions of this shared pool, not
// independent allowances — the old values (30/member, 200/admin) predated
// discovering the real ceiling and let one user's "personal" quota exceed
// the entire site's daily budget.
// Re-tune both once the real number is confirmed at
// https://aistudio.google.com/rate-limit for the account's actual tier.
const GLOBAL_DAILY_LIMIT = 15
const DAILY_LIMIT = { member: 3, admin: 8 }

// Schemas are written for Gemini's OpenAPI-subset Schema type (Type enum,
// not JSON Schema's bare "string"/"object" strings), and constraining the
// output shape this way is half the injection defence here — a submission
// can't get the model to emit free text outside these fields.
const POLISH_FORMAT = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'The copy-edited title, one line, no markdown.' },
    description: {
      type: Type.STRING,
      description: 'The copy-edited introduction, one line, no markdown.',
    },
    content: { type: Type.STRING, description: 'The copy-edited content, in markdown.' },
    notes: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Short lines describing the kinds of change made, across all fields.',
    },
  },
  required: ['title', 'description', 'content', 'notes'],
}

const PRESUBMIT_FORMAT = {
  type: Type.OBJECT,
  properties: {
    readiness: {
      type: Type.STRING,
      format: 'enum',
      enum: ['ready', 'needs_work'],
    },
    concerns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'One line per issue, addressed to the author. Empty when readiness is "ready".',
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'One to three specific things that work well. Empty if none stand out.',
    },
    suggestions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'One to four notes pointing at a specific part of the draft. Empty if the draft needs none.',
    },
  },
  required: ['readiness', 'concerns', 'strengths', 'suggestions'],
}

const MODERATE_FORMAT = {
  type: Type.OBJECT,
  properties: {
    recommendation: {
      type: Type.STRING,
      format: 'enum',
      enum: ['approve', 'review', 'reject'],
    },
    concerns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'One short line per issue found. Empty when there is nothing to raise.',
    },
    suggestedRejectionReason: {
      type: Type.STRING,
      description: 'Author-facing rejection message. Empty string unless recommending reject.',
    },
  },
  required: ['recommendation', 'concerns', 'suggestedRejectionReason'],
}

const TRANSLATE_FORMAT = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'The translated title, one line, no markdown.' },
    description: {
      type: Type.STRING,
      description: 'The translated introduction, one line, no markdown.',
    },
    content: { type: Type.STRING, description: 'The translated content, in markdown.' },
  },
  required: ['title', 'description', 'content'],
}

const polishOutput = z.object({
  title: z.string(),
  description: z.string(),
  content: z.string(),
  notes: z.array(z.string()),
})

const presubmitOutput = z.object({
  readiness: z.enum(['ready', 'needs_work']),
  concerns: z.array(z.string()),
  strengths: z.array(z.string()),
  suggestions: z.array(z.string()),
})

const moderateOutput = z.object({
  recommendation: z.enum(['approve', 'review', 'reject']),
  concerns: z.array(z.string()),
  suggestedRejectionReason: z.string(),
})

const translateOutput = z.object({
  title: z.string(),
  description: z.string(),
  content: z.string(),
})

// Bounds a stored field before it becomes prompt text. Nullable columns come
// back as null, which buildModerateUserMessage renders as the string "null" —
// an empty string reads better and says the same thing.
function clampField(value, max = 240) {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

function requireGemini() {
  if (!hasGeminiConfig()) {
    throw new HttpError(
      503,
      'AI_NOT_CONFIGURED',
      'Set GEMINI_API_KEY in the server environment to enable the writing assistant',
    )
  }
}

// Charges the caller's personal allowance first, then the shared one.
//
// The order used to be the other way round, on the reasoning that there was no
// point spending a user's allowance on a call the shared pool would refuse.
// But whichever counter is charged first sits transiently over-committed for
// the length of the second RPC, and it matters a great deal which one that is:
// an over-quota member clicking repeatedly (the per-IP limiter allows 20 per
// 5 minutes) would keep nudging the *shared* counter to its ceiling and back,
// and any other user landing in one of those windows got told the whole site
// was out of budget until tomorrow — a permanent-sounding message for
// something that clears in milliseconds. Charging personal first confines that
// transient to the one caller who is already over their limit anyway.
async function claimQuota(user) {
  const limit = user.role === 'admin' ? DAILY_LIMIT.admin : DAILY_LIMIT.member
  const personal = await consumeQuota(user.id, limit)
  if (!personal.allowed) {
    throw new HttpError(
      429,
      'AI_QUOTA_EXCEEDED',
      `You have used all ${limit} writing assistant requests for today (${personal.used} used). Try again tomorrow.`,
    )
  }

  let global
  try {
    global = await consumeGlobalQuota(GLOBAL_DAILY_LIMIT)
  } catch (error) {
    // The personal slot is already spent. Without this a transient Supabase
    // error would silently eat the caller's daily allowance for a request
    // that never reached the model.
    await refundQuota(user.id, personal.chargedDate).catch((refundError) => {
      console.error('[ai] user quota refund failed', refundError)
    })
    throw error
  }

  if (!global.allowed) {
    await refundQuota(user.id, personal.chargedDate).catch((error) => {
      console.error('[ai] user quota refund failed', error)
    })
    throw new HttpError(
      429,
      'AI_QUOTA_EXCEEDED',
      'The writing assistant has reached its shared usage limit for today across the whole site. Please try again tomorrow.',
    )
  }

  // Carried so a later refund targets the rows that were actually charged,
  // even if it lands on the other side of UTC midnight.
  return { globalDate: global.chargedDate, userDate: personal.chargedDate }
}

// Undoes the counters claimQuota() incremented, for a call that never reached
// the model. Failures are logged and swallowed — the caller should still see
// the original error, not a refund-plumbing one.
//
// `keepGlobal` holds the shared slot even though the request failed. That's
// for the one case where the failure is itself evidence the shared budget is
// gone: a 429 from Google. Refunding there would decrement the counter every
// time the provider rejects, so GLOBAL_DAILY_LIMIT could never accumulate and
// the gate whose whole job is to refuse *before* Google does would never trip
// — every request for the rest of the day would be forwarded to a provider
// certain to reject it. The caller's personal slot is still returned; they
// shouldn't pay for the site hitting a provider ceiling.
async function refundBothQuotas(userId, claim, { keepGlobal = false } = {}) {
  await Promise.all([
    refundQuota(userId, claim?.userDate).catch((error) =>
      console.error('[ai] user quota refund failed', error),
    ),
    keepGlobal
      ? Promise.resolve()
      : refundGlobalQuota(claim?.globalDate).catch((error) =>
          console.error('[ai] global quota refund failed', error),
        ),
  ])
}

// Finish reasons that mean the model refused or was blocked on safety
// grounds, as opposed to a normal stop or a length cutoff.
const REFUSAL_FINISH_REASONS = new Set([
  'SAFETY',
  'PROHIBITED_CONTENT',
  'BLOCKLIST',
  'SPII',
  'RECITATION',
])

async function runStructured({ userId, claim, system, userMessage, responseSchema, validator, maxOutputTokens }) {
  let response
  try {
    response = await gemini.models.generateContent({
      model: AI_MODEL,
      contents: userMessage,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseSchema,
        maxOutputTokens,
        // Low temperature suits copy-editing, one-line summaries, and
        // classification — none of this needs creative variance.
        temperature: 0.2,
        // Thinking tokens are drawn from the same maxOutputTokens budget as
        // the answer, so an unbounded (dynamic) budget can burn the whole
        // allowance before any JSON is written. thinkingBudget: 0 (fully
        // disabled) 400s on both "-latest" flash aliases tested against this
        // key, so this caps it small instead — none of these tasks
        // (copy-editing, one-line summaries, classification) need more.
        thinkingConfig: { thinkingBudget: 512 },
      },
    })
  } catch (error) {
    // Never surface the provider's error text — it can quote the prompt back,
    // which would hand an attacker a channel for reading the system prompt.
    console.error('[ai] request failed', { status: error?.status, name: error?.name })

    // A 429 here means Google's own daily cap was hit despite our own
    // GLOBAL_DAILY_LIMIT gate — e.g. usage outside this app (manual testing
    // against the same API key) counted against the same shared pool.
    const providerExhausted = error?.status === 429

    // The call never reached the model, so it never cost anything — hand
    // back the slots claimQuota() reserved. The shared slot is the exception
    // when the provider itself is out: see refundBothQuotas.
    await refundBothQuotas(userId, claim, { keepGlobal: providerExhausted })

    // Worth a distinct, honest message rather than "try again shortly",
    // which reads as a transient blip when it's really a same-day dead end.
    if (providerExhausted) {
      throw new HttpError(
        429,
        'AI_QUOTA_EXCEEDED',
        'The AI provider has reached its own daily limit for this project (separate from the per-user limit above). Please try again tomorrow.',
      )
    }

    throw new HttpError(
      502,
      'AI_REQUEST_FAILED',
      'The writing assistant is unavailable right now. Please try again shortly.',
    )
  }

  // A blocked prompt returns no candidates at all rather than a finish reason
  // on one, so this has to be checked before looking at candidates.
  if (response.promptFeedback?.blockReason) {
    throw new HttpError(
      422,
      'AI_REFUSED',
      'The writing assistant declined to process this text.',
    )
  }

  const finishReason = response.candidates?.[0]?.finishReason
  if (finishReason && REFUSAL_FINISH_REASONS.has(finishReason)) {
    throw new HttpError(
      422,
      'AI_REFUSED',
      'The writing assistant declined to process this text.',
    )
  }

  if (finishReason === 'MAX_TOKENS') {
    throw new HttpError(
      422,
      'AI_RESPONSE_TRUNCATED',
      'This draft is too long for the writing assistant to handle in one pass.',
    )
  }

  const invalid = () =>
    new HttpError(
      502,
      'AI_INVALID_RESPONSE',
      'The writing assistant returned an unusable response.',
    )

  const text = response.text
  if (!text) throw invalid()

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw invalid()
  }

  // Second gate behind the API-side schema: whatever comes back is shaped
  // the way the rest of the code assumes before it leaves this function.
  const validated = validator.safeParse(payload)
  if (!validated.success) throw invalid()

  return validated.data
}

export async function polishDraft(req, res, next) {
  try {
    // Before claimQuota, not after: an unconfigured key would otherwise charge
    // both counters on every 503 and, after GLOBAL_DAILY_LIMIT of them, leave
    // the feature dead for the rest of the day even once the key is set.
    requireGemini()
    const claim = await claimQuota(req.user)
    const { content, title, description } = req.validated.body

    const result = await runStructured({
      userId: req.user.id,
      claim,
      system: POLISH_SYSTEM,
      userMessage: buildPolishUserMessage({ title, description, content }),
      responseSchema: POLISH_FORMAT,
      validator: polishOutput,
      maxOutputTokens: 16000,
    })

    return res.json({
      title: result.title,
      description: result.description,
      content: result.content,
      notes: result.notes,
    })
  } catch (error) {
    return next(error)
  }
}

export async function checkBeforeSubmit(req, res, next) {
  try {
    requireGemini()
    const claim = await claimQuota(req.user)
    const { content, title, artist, bestPick, description } = req.validated.body

    const result = await runStructured({
      userId: req.user.id,
      claim,
      system: PRESUBMIT_SYSTEM,
      userMessage: buildPresubmitUserMessage({ title, artist, bestPick, description, content }),
      responseSchema: PRESUBMIT_FORMAT,
      validator: presubmitOutput,
      maxOutputTokens: 4096,
    })

    return res.json({
      readiness: result.readiness,
      concerns: result.concerns,
      strengths: result.strengths,
      suggestions: result.suggestions,
    })
  } catch (error) {
    return next(error)
  }
}

export async function moderatePost(req, res, next) {
  try {
    requireGemini()
    const { postId } = req.validated.body

    // Lookup before claimQuota: charging for a post that doesn't exist spends
    // a slot on a call that never reaches the model and never gets refunded,
    // so repeatedly clicking "AI review" on a just-deleted post could drain
    // the shared budget for the day.
    const post = await getPostById(postId)
    if (!post) {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found')
    }

    const claim = await claimQuota(req.user)

    // Unlike the client-supplied paths, this text comes from a stored row, and
    // posts.content has no length ceiling — so without a clamp a single
    // moderation call could ship hundreds of thousands of input tokens. The
    // marker matters as much as the clamp: cutting mid-sentence with no note
    // lets the model report "the post is unfinished / cuts off" as a genuine
    // concern, and the admin would see an authoritative verdict about a defect
    // that only the truncation created.
    const truncated = post.content.length > AI_INPUT_MAX_CHARS
    const content = truncated
      ? `${post.content.slice(0, AI_INPUT_MAX_CHARS)}\n\n[This post was cut off here for review length. Do not treat the abrupt ending as a flaw in the writing.]`
      : post.content

    const result = await runStructured({
      userId: req.user.id,
      claim,
      system: MODERATE_SYSTEM,
      userMessage: buildModerateUserMessage({
        // Every field is clamped, not just content. postSchema now caps these
        // on the way in, but rows written before that cap existed aren't
        // bounded by it, and this is the one path that reads stored text
        // straight into a prompt priced per input token.
        title: clampField(post.title),
        artist: clampField(post.artist),
        bestPick: clampField(post.bestPick),
        description: clampField(post.description, 2000),
        content,
      }),
      responseSchema: MODERATE_FORMAT,
      validator: moderateOutput,
      maxOutputTokens: 2048,
    })

    // Advisory only. Approving and rejecting stay on the admin-only post
    // routes — if this endpoint could publish, a prompt injection inside a
    // submission could approve itself.
    return res.json({
      postId,
      // So the admin can tell "the model read the whole thing" from "the model
      // read the first 20k characters of it".
      truncated,
      recommendation: result.recommendation,
      concerns: result.concerns,
      suggestedRejectionReason:
        result.recommendation === 'reject' ? result.suggestedRejectionReason : '',
    })
  } catch (error) {
    return next(error)
  }
}

export async function translatePost(req, res, next) {
  try {
    const { postId, targetLanguage } = req.validated.body

    const post = await getPostById(postId)
    // Only published posts are ever shown to a reader — translating a
    // pending/rejected one would leak content through a side channel that
    // doesn't go through the normal optionalAuth visibility check.
    if (!post || post.status !== 'published') {
      throw new HttpError(404, 'POST_NOT_FOUND', 'Post not found')
    }

    // Checked before requireGemini/claimQuota: a cache hit costs nothing and
    // shouldn't require the API key to be configured or spend a quota slot.
    const cached = await getCachedTranslation(postId, targetLanguage)
    if (cached) {
      return res.json({ postId, targetLanguage, cached: true, ...cached })
    }

    // Reaching here means generating a fresh translation, which spends a
    // quota slot and costs money — unlike a cache hit above, that much
    // requires being signed in even though the endpoint itself is public.
    if (!req.user) {
      throw new HttpError(
        401,
        'LOGIN_REQUIRED',
        'Log in to translate this article — once translated, anyone can read it in this language for free.',
      )
    }

    requireGemini()
    const claim = await claimQuota(req.user)

    const truncated = post.content.length > AI_INPUT_MAX_CHARS
    const content = truncated
      ? `${post.content.slice(0, AI_INPUT_MAX_CHARS)}\n\n[Cut off here for length.]`
      : post.content

    const result = await runStructured({
      userId: req.user.id,
      claim,
      system: buildTranslateSystem(targetLanguage),
      userMessage: buildTranslateUserMessage({
        title: clampField(post.title),
        description: clampField(post.description, 2000),
        content,
      }),
      responseSchema: TRANSLATE_FORMAT,
      validator: translateOutput,
      maxOutputTokens: 16000,
    })

    // Best-effort: a caching failure shouldn't turn a successful translation
    // into an error response. The next reader just pays for another call.
    await saveTranslation(postId, targetLanguage, result).catch((error) => {
      console.error('[ai] translation cache write failed', error)
    })

    return res.json({ postId, targetLanguage, cached: false, ...result })
  } catch (error) {
    return next(error)
  }
}
