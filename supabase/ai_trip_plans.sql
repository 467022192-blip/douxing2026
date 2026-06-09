-- AI 行程规划历史表
CREATE TABLE IF NOT EXISTS ai_trip_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    input_query TEXT NOT NULL,
    result_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_trip_plans_user_id ON ai_trip_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_trip_plans_created_at ON ai_trip_plans(created_at DESC);

ALTER TABLE ai_trip_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ai trip plans" ON ai_trip_plans;
CREATE POLICY "Users can view their own ai trip plans" ON ai_trip_plans
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own ai trip plans" ON ai_trip_plans;
CREATE POLICY "Users can insert their own ai trip plans" ON ai_trip_plans
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own ai trip plans" ON ai_trip_plans;
CREATE POLICY "Users can delete their own ai trip plans" ON ai_trip_plans
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own ai trip plans" ON ai_trip_plans;
CREATE POLICY "Users can update their own ai trip plans" ON ai_trip_plans
    FOR UPDATE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_ai_trip_plans_updated_at ON ai_trip_plans;
CREATE TRIGGER update_ai_trip_plans_updated_at BEFORE UPDATE ON ai_trip_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL ON ai_trip_plans TO anon, authenticated;
