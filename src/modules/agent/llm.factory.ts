import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

let customModelOverride: BaseChatModel | null = null;

// Sets a custom or mocked chat model (used in automated testing without real API keys)
export function setCustomChatModel(model: BaseChatModel | null): void {
  customModelOverride = model;
}

export function getChatModel(): BaseChatModel {
  if (customModelOverride) {
    return customModelOverride;
  }

  if (env.LLM_PROVIDER === 'gemini') {
    if (!env.GOOGLE_API_KEY && env.NODE_ENV !== 'test') {
      logger.warn('GOOGLE_API_KEY is not set. Ensure mockLLM is used or set the API key in .env');
    }
    return new ChatGoogleGenerativeAI({
      model: env.LLM_MODEL || 'gemini-2.0-flash',
      apiKey: env.GOOGLE_API_KEY,
      temperature: env.LLM_TEMPERATURE,
      maxRetries: 2,
    });
  }

  if (env.LLM_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY && env.NODE_ENV !== 'test') {
      logger.warn('OPENAI_API_KEY is not set. Ensure mockLLM is used or set the API key in .env');
    }
    return new ChatOpenAI({
      model: env.LLM_MODEL || 'gpt-4o-mini',
      apiKey: env.OPENAI_API_KEY,
      temperature: env.LLM_TEMPERATURE,
      maxRetries: 2,
    });
  }

  throw new Error(`Unsupported LLM_PROVIDER: ${env.LLM_PROVIDER}`);
}
