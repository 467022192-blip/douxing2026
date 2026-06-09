import { getPopularTripPlanById } from '../../src/data/popularTripPlans';

const json = (res: any, status: number, payload: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Method Not Allowed' });
  }

  const id = String(req.query?.id || '').trim();
  if (!id) {
    return json(res, 400, { error: '缺少热门攻略 ID。' });
  }

  const item = getPopularTripPlanById(id);
  if (!item) {
    return json(res, 404, { error: '热门攻略不存在。' });
  }

  return json(res, 200, item);
}
