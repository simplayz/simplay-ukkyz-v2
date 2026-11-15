export const AI_PROVIDERS = ["OpenAI", "Anthropic", "Google", "Mistral", "xAI", "OpenRouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiModel = {
  id: string;
  provider: AiProvider;
  label: string;
  context: string;
  cost: string;
  strength: string;
};

export const AI_MODELS: readonly AiModel[] = [
  { id: "gpt-5.2", provider: "OpenAI", label: "GPT-5.2", context: "400k", cost: "$$$", strength: "Deep technical planning and code synthesis" },
  { id: "gpt-5-mini", provider: "OpenAI", label: "GPT-5 mini", context: "400k", cost: "$", strength: "Fast operational triage" },
  { id: "claude-opus-4-6", provider: "Anthropic", label: "Claude Opus 4.6", context: "500k", cost: "$$$", strength: "Long-horizon strategy and finance review" },
  { id: "claude-sonnet-4-6", provider: "Anthropic", label: "Claude Sonnet 4.6", context: "500k", cost: "$$", strength: "Balanced management and analysis" },
  { id: "gemini-3-pro", provider: "Google", label: "Gemini 3 Pro", context: "1M", cost: "$$", strength: "Large-context logistics and mapping" },
  { id: "gemini-3-flash", provider: "Google", label: "Gemini 3 Flash", context: "1M", cost: "$", strength: "Rapid area monitoring" },
  { id: "mistral-large-3", provider: "Mistral", label: "Mistral Large 3", context: "256k", cost: "$$", strength: "Efficient structured operations" },
  { id: "codestral", provider: "Mistral", label: "Codestral", context: "256k", cost: "$", strength: "Infrastructure automation" },
  { id: "grok-4", provider: "xAI", label: "Grok 4", context: "256k", cost: "$$", strength: "Market scanning and scenario probes" },
  { id: "llama-4-maverick", provider: "OpenRouter", label: "Llama 4 Maverick", context: "1M", cost: "$", strength: "Open-weight general management" },
  { id: "qwen3-235b", provider: "OpenRouter", label: "Qwen3 235B", context: "262k", cost: "$", strength: "Multilingual planning and analysis" },
  { id: "deepseek-v3.2", provider: "OpenRouter", label: "DeepSeek V3.2", context: "164k", cost: "$", strength: "Cost-efficient technical reasoning" },
] as const;

export const BOT_ROLES = ["CTO", "CFO", "COO"] as const;
export type BotRole = (typeof BOT_ROLES)[number];

export const BOT_DEFAULTS: Record<BotRole, { name: string; provider: AiProvider; model: string; directive: string }> = {
  CTO: { name: "Ada", provider: "OpenAI", model: "gpt-5-mini", directive: "Audit build order, power resilience and technical debt. Propose the next infrastructure action.", },
  CFO: { name: "Rook", provider: "Anthropic", model: "claude-sonnet-4-6", directive: "Protect the treasury. Compare net ticks, upkeep and payback time before any commission.", },
  COO: { name: "Mara", provider: "Google", model: "gemini-3-flash", directive: "Keep food, staff and site logistics balanced. Flag reception or guard coverage gaps.", },
};

export function isAiModel(provider: string, model: string): boolean {
  return AI_MODELS.some((entry) => entry.provider === provider && entry.id === model);
}
