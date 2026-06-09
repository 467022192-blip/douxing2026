import {
  createAiTripPlan,
  getAiTripPlanById,
  getAiTripPlanSummariesByUser,
  getAiTripPlansByUser
} from './supabaseService';
import { POPULAR_TRIP_PLANS, getPopularTripPlanById } from '../data/popularTripPlans';
import type {
  PublicPopularAiTripPlanDetail,
  PublicPopularAiTripPlanSummary,
  ResolvedAiTripPlanDetail,
  SavedAiTripPlan,
  SavedAiTripPlanSummary,
  TripPlanResult
} from '../types';

const parseJsonError = async (response: Response) => {
  try {
    const payload = await response.json();
    return typeof payload?.error === 'string' ? payload.error : '';
  } catch {
    return '';
  }
};

const parseJsonResponse = async <T>(response: Response, fallbackMessage: string): Promise<T> => {
  if (!response.ok) {
    const detail = await parseJsonError(response);
    throw new Error(detail || fallbackMessage);
  }

  return response.json() as Promise<T>;
};

export const isPublicPopularTripPlanId = (id: string) => id.startsWith('popular-');

const buildPopularTripPlanSummaryFallback = (): PublicPopularAiTripPlanSummary[] =>
  POPULAR_TRIP_PLANS.map((item) => ({
    id: item.id,
    title: item.result_json.options[0]?.title || item.input_query,
    summary: item.result_json.options[0]?.reason || item.input_query,
    cover_prompt: item.cover_prompt,
    author_nickname: item.author_nickname,
    created_at: item.created_at
  }));

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

  return parseJsonResponse<TripPlanResult>(response, 'AI 行程规划生成失败，请稍后重试');
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

export const getMyAiTripPlanSummaries = async (userId: string): Promise<SavedAiTripPlanSummary[]> => {
  return getAiTripPlanSummariesByUser(userId);
};

export const getAiTripPlanDetail = async (id: string): Promise<SavedAiTripPlan> => {
  return getAiTripPlanById(id);
};

export const getPopularAiTripPlans = async (): Promise<PublicPopularAiTripPlanSummary[]> => {
  try {
    const response = await fetch('/api/popular-trip-plans');
    return await parseJsonResponse<PublicPopularAiTripPlanSummary[]>(response, '加载热门攻略失败，请稍后再试');
  } catch {
    return buildPopularTripPlanSummaryFallback();
  }
};

export const getPublicAiTripPlanDetail = async (id: string): Promise<PublicPopularAiTripPlanDetail> => {
  try {
    const response = await fetch(`/api/popular-trip-plans/${id}`);
    return await parseJsonResponse<PublicPopularAiTripPlanDetail>(response, '加载热门攻略详情失败，请稍后再试');
  } catch {
    const localDetail = getPopularTripPlanById(id);
    if (!localDetail) {
      throw new Error('加载热门攻略详情失败，请稍后再试');
    }
    return localDetail;
  }
};

export const resolveAiTripPlanDetail = async (id: string): Promise<ResolvedAiTripPlanDetail> => {
  if (isPublicPopularTripPlanId(id)) {
    const publicItem = await getPublicAiTripPlanDetail(id);
    return {
      ...publicItem,
      source: 'public',
      source_label: '平台热门攻略'
    };
  }

  const privateItem = await getAiTripPlanDetail(id);
  return {
    ...privateItem,
    source: 'private',
    source_label: '已保存攻略'
  };
};
