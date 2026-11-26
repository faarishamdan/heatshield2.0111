import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '1mb' }));

function hasGeminiKey(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'MY_GEMINI_API_KEY');
}

function hasOpenRouterKey(): boolean {
  const apiKey = process.env.OPENROUTER_API_KEY;
  return Boolean(apiKey && apiKey.trim() !== '' && apiKey !== 'MY_OPENROUTER_API_KEY');
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '' || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callOpenRouter(promptText: string): Promise<{ text: string; model: string }> {
  const openRouterKey = process.env.OPENROUTER_API_KEY!.trim();
  const preferredModels = process.env.OPENROUTER_MODEL?.trim()
    ? [process.env.OPENROUTER_MODEL.trim()]
    : ['openrouter/free', 'google/gemma-3-27b-it:free'];

  let lastError = 'OpenRouter request failed.';
  for (const modelId of preferredModels) {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterKey}`,
        'X-Title': 'HEATSHIELD AI',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: SAFETY_SYSTEM_INSTRUCTION },
          { role: 'user', content: promptText },
        ],
      }),
    });

    if (orRes.ok) {
      const data = (await orRes.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };
      return {
        text: data.choices?.[0]?.message?.content ?? 'No response returned.',
        model: data.model ?? modelId,
      };
    }

    const errBody = await orRes.text();
    lastError = `OpenRouter request failed (${orRes.status}): ${errBody.slice(0, 180)}`;
  }

  throw new Error(lastError);
}

async function generateSafetyText(promptText: string): Promise<{ text: string; model: string }> {
  if (hasOpenRouterKey()) {
    return callOpenRouter(promptText);
  }

  if (hasGeminiKey()) {
    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: promptText }] }],
        config: {
          systemInstruction: SAFETY_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      return {
        text: response.text ?? 'No analysis text returned.',
        model: 'gemini-4-hydrogen',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
        throw new Error(
          'Gemini API returned PERMISSION_DENIED (403) for this project. Enable billing/select a valid GEMINI_API_KEY or add OPENROUTER_API_KEY in Settings > Secrets.'
        );
      }
      throw err;
    }
  }

  throw new Error(
    'No AI API key is configured on the server. Add GEMINI_API_KEY or OPENROUTER_API_KEY in Settings > Secrets.'
  );
}

const SAFETY_SYSTEM_INSTRUCTION = `You are the HEATSHIELD AI Safety Information Assistant for outdoor and construction workers.
Strict scientific and safety boundaries you MUST follow in every response:
1. Never present any output as a medical diagnosis, clinical assessment, or guaranteed prediction of heat illness or falls.
2. Always note when relevant that Heat Index is an environmental estimate based on ambient air temperature and relative humidity—it is NOT core body temperature and NOT Wet-Bulb Globe Temperature (WBGT, which also accounts for solar radiation and wind).
3. Ground advice in practical, widely recognized general occupational heat-safety principles (hydration, shaded/cooled rest breaks, acclimatization awareness, buddy system, and stopping work if symptoms occur).
4. Base your analysis strictly on the telemetry numbers provided in the prompt. If no live or historical telemetry is provided, state that clearly instead of inventing numbers.
5. Keep responses concise, structured, and easy for a field worker or site supervisor to scan on a phone or laptop.`;

interface TelemetrySummaryItem {
  temperature: number;
  humidity: number;
  heatIndex: number;
  activityLabel?: string;
  anomalyFlagged?: boolean;
  source?: string;
  recordedAtIso?: string;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'heatshield-ai',
    aiConfigured: hasGeminiKey() || hasOpenRouterKey(),
  });
});

app.post('/api/ai/analyze', async (req, res) => {
  try {
    const body = req.body as {
      mode?: string;
      currentReading?: TelemetrySummaryItem | null;
      recentHistory?: TelemetrySummaryItem[];
      thresholds?: {
        cautionThresholdC?: number;
        warningThresholdC?: number;
        dangerThresholdC?: number;
      };
      workerContext?: {
        workerName?: string;
        siteLocation?: string;
      };
    };

    const mode = typeof body.mode === 'string' ? body.mode : 'explain';
    const allowedModes = ['explain', 'summary', 'patterns', 'safety_tips'];
    if (!allowedModes.includes(mode)) {
      res.status(400).json({ error: 'Invalid analysis mode requested.' });
      return;
    }

    const history = Array.isArray(body.recentHistory) ? body.recentHistory.slice(0, 60) : [];
    const current = body.currentReading ?? null;

    if (!current && history.length === 0) {
      res.status(400).json({
        error: 'No sensor telemetry is available to analyze. Connect an ESP32 wearable or load Demonstration Replay first.',
      });
      return;
    }

    let taskPrompt = '';
    if (mode === 'explain') {
      taskPrompt =
        'Explain the current environmental heat-exposure reading and motion activity state in plain language for the worker, referencing the configured thresholds and reminding them what Heat Index measures versus core body temperature/WBGT.';
    } else if (mode === 'summary') {
      taskPrompt =
        'Summarize the recorded environmental conditions across the provided history (min/max/average temperature, humidity, heat index, and any motion spikes flagged for review).';
    } else if (mode === 'patterns') {
      taskPrompt =
        'Identify observable patterns or trends in the historical sensor readings (for example rising heat-index windows, humidity spikes, or high-activity periods coinciding with elevated heat index). Do not extrapolate beyond the recorded data.';
    } else {
      taskPrompt =
        'Provide practical general heat-safety reminders tailored to the current environmental conditions and activity level (hydration cadence, shaded rest, buddy checks, and threshold precautions).';
    }

    const promptText = `${taskPrompt}\n\nWorker Context: ${JSON.stringify(body.workerContext ?? {})}\nConfigured Thresholds (°C Heat Index): ${JSON.stringify(body.thresholds ?? {})}\nCurrent Reading: ${JSON.stringify(current)}\nRecent History (${history.length} records): ${JSON.stringify(history)}`;
    const result = await generateSafetyText(promptText);

    res.json({
      analysis: result.text,
      model: result.model,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate AI safety analysis.';
    const status = message.includes('not configured') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const body = req.body as {
      question?: string;
      currentReading?: TelemetrySummaryItem | null;
      recentHistory?: TelemetrySummaryItem[];
      thresholds?: Record<string, number>;
    };

    const question = typeof body.question === 'string' ? body.question.trim() : '';
    if (!question || question.length > 1000) {
      res.status(400).json({ error: 'Please enter a safety question between 1 and 1000 characters.' });
      return;
    }

    const history = Array.isArray(body.recentHistory) ? body.recentHistory.slice(0, 40) : [];
    const promptText = `Worker Question: ${question}\n\nLatest Telemetry: ${JSON.stringify(body.currentReading ?? null)}\nConfigured Thresholds (°C): ${JSON.stringify(body.thresholds ?? {})}\nRecent History (${history.length} records): ${JSON.stringify(history)}`;
    const result = await generateSafetyText(promptText);

    res.json({
      reply: result.text,
      model: result.model,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process AI safety question.';
    const status = message.includes('not configured') ? 503 : 500;
    res.status(status).json({ error: message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HEATSHIELD AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start HEATSHIELD AI server:', err);
  process.exit(1);
});
