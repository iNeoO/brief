import type { LLM_PROVIDER } from "../constants/llm.constant.js";

export type LlmProvider = (typeof LLM_PROVIDER)[keyof typeof LLM_PROVIDER];
