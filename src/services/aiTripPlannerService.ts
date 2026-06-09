import { createAiTripPlan, getAiTripPlansByUser } from './supabaseService';
import type { SavedAiTripPlan, TripPlanResult } from '../types';

const parseJsonError = async (response: Response) => {
  try {
    const payload = await response.json();
    return typeof payload?.error === 'string' ? payload.error : '';
  } catch {
    return '';
  }
};

export const generateAiTripPlans = async (
  query: string,
  options?: { signal?: AbortSignal }
): Promise<TripPlanResult> => {
  const response = await fetch('/api/ai-trip-plans', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query }),
    signal: options?.signal
  });

  if (!response.ok) {
    const detail = await parseJsonError(response);
    throw new Error(detail || 'AI 行程规划生成失败，请稍后重试');
  }

  return response.json() as Promise<TripPlanResult>;
};

export const saveAiTripPlan = async (
  userId: string,
  query: string,
  result: TripPlanResult
): Promise<SavedAiTripPlan> => {
  return createAiTripPlan(userId, query, result);
};

export const getMyAiTripPlans = async (userId: string): Promise<SavedAiTripPlan[]> => {
  return getAiTripPlansByUser(userId);
};
