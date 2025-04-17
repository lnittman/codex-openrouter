import { OPENAI_API_KEY, OPENROUTER_API_KEY, OPENAI_BASE_URL, OPENROUTER_BASE_URL } from "./config";
import OpenAI from "openai";

const MODEL_LIST_TIMEOUT_MS = 2_000; // 2 seconds
export const RECOMMENDED_MODELS: Array<string> = ["o4-mini", "o3"];

/**
 * Background model loader / cache.
 *
 * We start fetching the list of available models from OpenAI once the CLI
 * enters interactive mode.  The request is made exactly once during the
 * lifetime of the process and the results are cached for subsequent calls.
 */

let modelsPromise: Promise<Array<string>> | null = null;
let openRouterModelsPromise: Promise<Array<string>> | null = null;

async function fetchOpenAIModels(): Promise<Array<string>> {
  // If the user has not configured an API key we cannot hit the network.
  if (!OPENAI_API_KEY) {
    return RECOMMENDED_MODELS;
  }

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const list = await openai.models.list();

    const models: Array<string> = [];
    for await (const model of list as AsyncIterable<{ id?: string }>) {
      if (model && typeof model.id === "string") {
        models.push(model.id);
      }
    }

    return models.sort();
  } catch {
    return [];
  }
}

async function fetchOpenRouterModels(): Promise<Array<string>> {
  console.log("[OpenRouter] Fetching models, API key exists:", !!OPENROUTER_API_KEY);
  
  if (!OPENROUTER_API_KEY) {
    console.log("[OpenRouter] No API key found");
    return [];
  }

  try {
    console.log("[OpenRouter] Making request to:", `${OPENROUTER_BASE_URL}/models`);
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://github.com/openai/codex"
      }
    });
    
    if (!response.ok) {
      console.log("[OpenRouter] Response not OK:", response.status, response.statusText);
      return [];
    }
    
    const data = await response.json();
    console.log("[OpenRouter] Models response:", data.data ? data.data.length : "no data");
    const models = data.data?.map((model: { id: string }) => model.id) || [];
    console.log("[OpenRouter] Available models:", models);
    return models.sort();
  } catch (error) {
    console.log("[OpenRouter] Error fetching models:", error);
    return [];
  }
}

async function fetchModels(): Promise<Array<string>> {
  return await fetchOpenAIModels();
}

export function preloadModels(useOpenRouter: boolean = false): void {
  console.log("[Models] preloadModels called with useOpenRouter:", useOpenRouter);
  
  if (useOpenRouter) {
    console.log("[Models] Preloading OpenRouter models");
    if (!openRouterModelsPromise) {
      void getAvailableOpenRouterModels();
    }
  } else if (!modelsPromise) {
    console.log("[Models] Preloading OpenAI models");
    void getAvailableModels();
  }
}

export async function getAvailableModels(): Promise<Array<string>> {
  if (!modelsPromise) {
    modelsPromise = fetchOpenAIModels();
  }
  return modelsPromise;
}

export async function getAvailableOpenRouterModels(): Promise<Array<string>> {
  if (!openRouterModelsPromise) {
    openRouterModelsPromise = fetchOpenRouterModels();
  }
  return openRouterModelsPromise;
}

/**
 * Verify that the provided model identifier is present in the set returned by
 * {@link getAvailableModels} or {@link getAvailableOpenRouterModels}. 
 * The list of models is fetched from the appropriate API the first time 
 * it is required and then cached in‑process.
 */
export async function isModelSupportedForResponses(
  model: string | undefined | null,
  useOpenRouter: boolean = false
): Promise<boolean> {
  console.log("[ModelCheck] Checking if model is supported:", model, "useOpenRouter:", useOpenRouter);
  
  if (
    typeof model !== "string" ||
    model.trim() === "" ||
    (!useOpenRouter && RECOMMENDED_MODELS.includes(model))
  ) {
    console.log("[ModelCheck] Model is recommended or empty, allowing");
    return true;
  }

  try {
    console.log("[ModelCheck] Fetching available models for", useOpenRouter ? "OpenRouter" : "OpenAI");
    const modelsPromise = useOpenRouter 
      ? getAvailableOpenRouterModels()
      : getAvailableModels();
      
    const models = await Promise.race<Array<string>>([
      modelsPromise,
      new Promise<Array<string>>((resolve) =>
        setTimeout(() => resolve([]), MODEL_LIST_TIMEOUT_MS),
      ),
    ]);

    // If the timeout fired we get an empty list → treat as supported to avoid
    // false negatives.
    if (models.length === 0) {
      console.log("[ModelCheck] No models returned (timeout or empty list), allowing");
      return true;
    }

    const isSupported = models.includes(model.trim());
    console.log("[ModelCheck] Model support check result:", isSupported, "Available models count:", models.length);
    return isSupported;
  } catch (error) {
    // Network or library failure → don't block start‑up.
    console.log("[ModelCheck] Error checking model support:", error);
    return true;
  }
}
