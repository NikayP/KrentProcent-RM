import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { parseMenuFallback } from '../src/utils/menuParser.js';
import {
  ALLOWED_SCAN_MIME_TYPES,
  normalizeScanMimeType,
  type AllowedScanMimeType,
} from './scanMime.js';
import { SlidingWindowRateLimiter, getClientIp } from './rateLimit.ts';
import { parseVisionResponse } from './visionParser.ts';

export { ALLOWED_SCAN_MIME_TYPES, normalizeScanMimeType, parseVisionResponse, type AllowedScanMimeType };

const MAX_BASE64_LENGTH = 6_000_000; // ~4.5 MB raw payload
const MAX_TEXT_LENGTH = 50_000;

const scanRateLimiter = new SlidingWindowRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 20,
});

// Lazily initialize Google GenAI client so env vars loaded at runtime are always picked up
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (apiKey) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export const maxDuration = 60;

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const ip = getClientIp(req);
  const limit = scanRateLimiter.check(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many menu scans in a short time. Please wait a moment and try again.',
    });
  }

  try {
    const rawBody = req.body && typeof req.body === 'object' ? req.body : {};
    const imageBase64 = typeof rawBody.imageBase64 === 'string' ? rawBody.imageBase64 : '';
    const textInput = typeof rawBody.textInput === 'string' ? rawBody.textInput : '';

    if (!imageBase64 && !textInput) {
      return res.status(400).json({ error: 'Please provide an image, PDF, or menu text.' });
    }

    if (imageBase64.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({
        error: 'The uploaded file is too large. Please use a smaller image or PDF (max 3 MB).',
      });
    }

    if (textInput.length > MAX_TEXT_LENGTH) {
      return res.status(413).json({
        error: 'The pasted menu text is too long. Please trim it and try again.',
      });
    }

    let normalizedMime: AllowedScanMimeType = 'image/jpeg';
    if (imageBase64) {
      const rawMime = rawBody.mimeType === undefined ? 'image/jpeg' : rawBody.mimeType;
      const validated = normalizeScanMimeType(rawMime);
      if (!validated) {
        return res.status(400).json({
          error: 'Unsupported file type. Please upload a JPG, PNG, WebP, HEIC image or PDF.',
        });
      }
      normalizedMime = validated;
    }

    const isPdf = normalizedMime === 'application/pdf';
    const userSpecifiedBar = typeof rawBody.barName === 'string' ? rawBody.barName.trim() : '';
    const scanStartTime = Date.now();

    // Fast path: if only textInput is provided (no image), parse locally in <2ms!
    if (!imageBase64 && textInput) {
      const fastLocal = parseMenuFallback(textInput, userSpecifiedBar);
      if (fastLocal.drinks && fastLocal.drinks.length > 0) {
        return res.status(200).json({
          detectedBarName: fastLocal.detectedBarName,
          drinks: fastLocal.drinks,
          durationMs: Date.now() - scanStartTime,
          modelUsed: 'local-instant-parser',
        });
      }
    }

    const client = getAiClient();
    if (!client) {
      if (imageBase64 && !textInput) {
        return res.status(400).json({
          error:
            'Image scanning requires GEMINI_API_KEY to be set in Vercel Environment Variables. Please set GEMINI_API_KEY or switch to the "Paste Menu Text" tab.',
        });
      }
      const parsedResult = parseMenuFallback(textInput || '', userSpecifiedBar);
      return res.status(200).json({
        detectedBarName: parsedResult.detectedBarName,
        drinks: parsedResult.drinks,
        note: 'Scanned via local heuristic parser (Gemini API key not configured).',
      });
    }

    // Ultra-compact prompt optimized for both Flash-Lite and Flash models
    const promptText = `Transcribe ALL drinks (beers, wines, spirits, ciders) from every column/section of this menu. Ignore UI frames/buttons.
${
  userSpecifiedBar
    ? ''
    : 'If venue name is visible, include one line: BAR|Venue Name\n'
}Output ONLY pipe-separated lines (NO JSON, NO markdown, NO headers, NO extra text):
Name|Cat|VolumeMl|ABV|Price
Rules:
- Cat codes: b=beer, w=wine, s=spirit, c=cocktail, ci=cider, o=other
- Every drink line MUST end with its numeric Price (e.g. 5,1 -> 5.10, (4,90) -> 4.90, €3,60 -> 3.60). Do NOT confuse Price with ABV%!
- CRITICAL: If a drink has "0.0", "0,0", or "Alcoholvrij" in its name (e.g. Heineken 0.0, Amstel Radler 0.0, Guinness 0.0, Affligem 0.0, Paulaner 0.0, Kasteel Rouge 0.0), its ABV MUST be 0.0 (NEVER 5.0!).
- Defaults if not printed: vaasje=250, fluitje=200, bottle/speciaalbier=330, weizen/pint=500, wine=150, shot=35, pilsabv=5.0.
${isPdf ? '- The menu may span multiple pages; include drinks from every page.\n' : ''}Example:
Brand Pilsener|b|250|5.0|3.70
Heineken 0.0|b|330|0.0|3.50
Westmalle Tripel|b|330|9.5|5.80`;

    const contents: any[] = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:[^,]+;base64,/, '');
      contents.push({
        inlineData: {
          mimeType: normalizedMime,
          data: cleanBase64,
        },
      });
    }

    contents.push({
      text: promptText + (textInput ? `\n\nMenu:\n${textInput}` : ''),
    });

    const formattedContents = contents.length === 1 ? contents[0] : { parts: contents };

    type ModelScanResult = {
      modelName: string;
      elapsedMs: number;
      drinks: any[];
      detectedBarName: string;
    };

    // Helper to invoke a single model with AbortSignal support and parse its vision output
    const runSingleModel = async (
      modelName: string,
      signal: AbortSignal
    ): Promise<ModelScanResult> => {
      const modelStart = Date.now();
      const isLiteModel = modelName.includes('lite');
      const response = await client.models.generateContent({
        model: modelName,
        contents: formattedContents,
        config: isLiteModel
          ? { temperature: 0, abortSignal: signal }
          : {
              temperature: 0,
              abortSignal: signal,
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
      });
      const rawText = response.text || '';
      const parsedResult = parseVisionResponse(rawText, userSpecifiedBar);
      return {
        modelName,
        elapsedMs: Date.now() - modelStart,
        drinks: parsedResult.drinks || [],
        detectedBarName: parsedResult.detectedBarName,
      };
    };

    /**
     * Cost-efficient hedged request strategy:
     * - Starts 1 fast primary model immediately (1 API call on the happy path instead of 3-6).
     * - Only launches the hedge model if the primary fails, returns 0 drinks, or exceeds hedgeDelayMs.
     * - Aborts any losing in-flight request via AbortController as soon as a winner returns drinks.
     */
    const runHedgedPair = (
      primaryModel: string,
      hedgeModel: string,
      hedgeDelayMs: number,
      overallTimeoutMs: number
    ): Promise<ModelScanResult | null> => {
      return new Promise((resolve) => {
        let settled = false;
        let hedgeStarted = false;
        let inFlight = 0;
        const controllers: AbortController[] = [];
        let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

        const finish = (winner: ModelScanResult | null) => {
          if (settled) return;
          settled = true;
          if (hedgeTimer) clearTimeout(hedgeTimer);
          clearTimeout(overallTimer);
          for (const c of controllers) {
            if (!c.signal.aborted) c.abort();
          }
          resolve(winner);
        };

        const launch = (modelName: string, onEmptyOrError?: () => void) => {
          if (settled) return;
          const controller = new AbortController();
          controllers.push(controller);
          inFlight++;

          runSingleModel(modelName, controller.signal)
            .then((result) => {
              if (settled) return;
              if (result.drinks.length > 0) {
                finish(result);
              } else {
                onEmptyOrError?.();
              }
            })
            .catch((err: any) => {
              if (!settled && !controller.signal.aborted) {
                console.warn(
                  `[scan-menu] ${modelName} error (${err?.message?.slice(0, 80) || 'unknown'})`
                );
                onEmptyOrError?.();
              }
            })
            .finally(() => {
              inFlight--;
              if (!settled && hedgeStarted && inFlight <= 0) {
                finish(null);
              }
            });
        };

        const startHedge = () => {
          if (settled || hedgeStarted) return;
          hedgeStarted = true;
          if (hedgeTimer) {
            clearTimeout(hedgeTimer);
            hedgeTimer = null;
          }
          launch(hedgeModel);
        };

        const overallTimer = setTimeout(() => {
          finish(null);
        }, overallTimeoutMs);

        hedgeTimer = setTimeout(startHedge, hedgeDelayMs);
        launch(primaryModel, startHedge);
      });
    };

    // Primary: fast Flash-Lite, hedged with Flash only if slow or failing
    let winningResult = await runHedgedPair(
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      isPdf ? 9000 : 4500,
      isPdf ? 28000 : 18000
    );

    // Final single fallback only if both primary and hedge returned 0 drinks
    if (!winningResult || winningResult.drinks.length === 0) {
      const fallbackController = new AbortController();
      const fallbackTimer = setTimeout(
        () => fallbackController.abort(),
        isPdf ? 20000 : 14000
      );
      try {
        const resFallback = await runSingleModel(
          'gemini-3.5-flash-lite',
          fallbackController.signal
        );
        if (resFallback.drinks.length > 0) {
          winningResult = resFallback;
        }
      } catch (err: any) {
        if (!fallbackController.signal.aborted) {
          console.warn(
            `[scan-menu] fallback error (${err?.message?.slice(0, 80) || 'unknown'})`
          );
        }
      } finally {
        clearTimeout(fallbackTimer);
      }
    }

    if (winningResult && winningResult.drinks.length > 0) {
      const finalBarName =
        userSpecifiedBar || winningResult.detectedBarName || 'Current Bar';
      return res.status(200).json({
        detectedBarName: finalBarName,
        drinks: winningResult.drinks.map((d: any) => ({
          ...d,
          barName: finalBarName,
        })),
        modelUsed: winningResult.modelName,
        durationMs: Date.now() - scanStartTime,
      });
    }

    // If AI calls failed or returned 0 drinks, and text was provided, use fallback text parser
    if (textInput) {
      const fallback = parseMenuFallback(textInput, userSpecifiedBar);
      return res.status(200).json({
        detectedBarName: fallback.detectedBarName,
        drinks: fallback.drinks,
        warning: 'AI parsing encountered an issue, used local text parser.',
      });
    }

    // If no drinks found
    return res.status(422).json({
      error:
        'Could not detect any alcoholic drinks from the menu image. Please ensure the menu photo is in focus or try entering text on the "Paste Menu Text" tab.',
    });
  } catch (error: any) {
    console.error('[api/scan-menu] Error scanning menu:', error);
    if (typeof req.body?.textInput === 'string' && req.body.textInput.trim()) {
      const userSpecifiedBar =
        typeof req.body?.barName === 'string' ? req.body.barName.trim() : '';
      const fallback = parseMenuFallback(req.body.textInput, userSpecifiedBar);
      return res.status(200).json({
        detectedBarName: fallback.detectedBarName,
        drinks: fallback.drinks,
        warning: 'AI parsing encountered an issue, used local fallback.',
      });
    }
    return res.status(500).json({
      error: 'Failed to analyze menu image. Please verify the image is clear or try entering text.',
    });
  }
}
