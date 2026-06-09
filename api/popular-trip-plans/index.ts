import { POPULAR_TRIP_PLANS } from '../../src/data/popularTripPlans';

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

  return json(
    res,
    200,
    POPULAR_TRIP_PLANS.map((item) => ({
      id: item.id,
      title: item.result_json.options[0]?.title || item.input_query,
      summary: item.result_json.options[0]?.reason || item.input_query,
      cover_prompt: item.cover_prompt,
      author_nickname: item.author_nickname,
      created_at: item.created_at
    }))
  );
}
