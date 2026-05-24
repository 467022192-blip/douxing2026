-- ============================================
-- 空间社交功能表结构及 RLS 配置
-- ============================================

-- 0. 修复由于之前错误导致的类型冲突
DO $$
BEGIN
    ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_attraction_id_fkey;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE IF EXISTS posts ALTER COLUMN attraction_id TYPE VARCHAR(255);
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- 1. 动态表 (posts)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attraction_id VARCHAR(255) NOT NULL,
    content TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_attraction_id ON posts(attraction_id);
CREATE INDEX IF NOT EXISTS idx_posts_is_private ON posts(is_private);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- 2. 点赞表 (likes)
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);

-- 3. 评论表 (comments)
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);

-- 4. 触发器
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_posts_updated_at') THEN
        CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_comments_updated_at') THEN
        CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- 5. RLS (Row Level Security) 策略
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 动态表策略
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
    DROP POLICY IF EXISTS "Users can insert their own posts" ON posts;
    DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
    DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
END
$$;

CREATE POLICY "Public posts are viewable by everyone" ON posts
    FOR SELECT USING (is_private = false OR auth.uid() = user_id);
CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- 点赞表策略
DO $$
BEGIN
    DROP POLICY IF EXISTS "Likes are viewable by everyone" ON likes;
    DROP POLICY IF EXISTS "Users can insert their own likes" ON likes;
    DROP POLICY IF EXISTS "Users can delete their own likes" ON likes;
END
$$;

CREATE POLICY "Likes are viewable by everyone" ON likes
    FOR SELECT USING (true);
CREATE POLICY "Users can insert their own likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- 评论表策略
DO $$
BEGIN
    DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
    DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
    DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
END
$$;

CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);
CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- 6. 强制刷新 Schema 缓存 (避免 PGRST205 错误)
NOTIFY pgrst, 'reload schema';
