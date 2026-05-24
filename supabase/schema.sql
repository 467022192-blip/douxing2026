-- ============================================
-- 足迹 - 中国5A级景区打卡应用 数据库 Schema
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 景区表 (attractions)
-- ============================================
CREATE TABLE IF NOT EXISTS attractions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    address VARCHAR(300),
    description TEXT,
    features TEXT,
    tips TEXT,
    ticket_price DECIMAL(10,2),
    open_time VARCHAR(50),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    image_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 景区表索引
CREATE INDEX idx_attractions_province ON attractions(province);
CREATE INDEX idx_attractions_name ON attractions(name);

-- ============================================
-- 2. 用户资料表 (profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    phone VARCHAR(20),
    nickname VARCHAR(100) NOT NULL DEFAULT '用户',
    avatar_url VARCHAR(500),
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户资料表索引
CREATE INDEX idx_profiles_email ON profiles(email);

-- ============================================
-- 3. 用户打卡表 (user_checkins)
-- ============================================
CREATE TABLE IF NOT EXISTS user_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('visited', 'want_to_visit')),
    visit_count INTEGER DEFAULT 1,
    visited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, attraction_id)
);

-- 打卡表索引
CREATE INDEX idx_checkins_user_id ON user_checkins(user_id);
CREATE INDEX idx_checkins_attraction_id ON user_checkins(attraction_id);
CREATE INDEX idx_checkins_status ON user_checkins(status);

-- ============================================
-- 4. 动态表 (posts)
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    attraction_id UUID NOT NULL REFERENCES attractions(id) ON DELETE CASCADE,
    content TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 动态表索引
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_attraction_id ON posts(attraction_id);
CREATE INDEX idx_posts_is_private ON posts(is_private);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- ============================================
-- 5. 点赞表 (likes)
-- ============================================
CREATE TABLE IF NOT EXISTS likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- 点赞表索引
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);

-- ============================================
-- 6. 评论表 (comments)
-- ============================================
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 评论表索引
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);

-- ============================================
-- 7. 创建存储桶 (Storage)
-- ============================================
-- 需要在 Supabase Dashboard 中手动创建存储桶 'images'
-- 或者使用 SQL (如果 Supabase 支持):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('images', 'images', true);

-- ============================================
-- 8. 触发器函数
-- ============================================

-- 自动更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要自动更新 updated_at 的表创建触发器
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_checkins_updated_at BEFORE UPDATE ON user_checkins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 景区表所有人可读
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Attractions are viewable by everyone" ON attractions
    FOR SELECT USING (true);

-- 用户资料表策略
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 打卡表策略
CREATE POLICY "Checkins are viewable by everyone" ON user_checkins
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own checkins" ON user_checkins
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checkins" ON user_checkins
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checkins" ON user_checkins
    FOR DELETE USING (auth.uid() = user_id);

-- 动态表策略
CREATE POLICY "Public posts are viewable by everyone" ON posts
    FOR SELECT USING (is_private = false OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own posts" ON posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
    FOR DELETE USING (auth.uid() = user_id);

-- 点赞表策略
CREATE POLICY "Likes are viewable by everyone" ON likes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own likes" ON likes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON likes
    FOR DELETE USING (auth.uid() = user_id);

-- 评论表策略
CREATE POLICY "Comments are viewable by everyone" ON comments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comments" ON comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 10. 初始化数据 - 5A级景区
-- ============================================

-- 插入部分5A级景区数据（示例）
INSERT INTO attractions (id, name, province, city, address, description, features, tips, ticket_price, open_time, latitude, longitude, image_url) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', '故宫博物院', '北京', '北京', '北京市东城区景山前街4号', '中国明清两代的皇家宫殿，旧称紫禁城，位于北京中轴线的中心，是中国古代宫廷建筑之精华。', '世界文化遗产、中国古代宫殿建筑、珍贵文物收藏', '建议提前网上预约门票，避开节假日人流高峰', 60.00, '08:30-17:00', 39.916345, 116.397155, 'https://picsum.photos/400/300?random=1'),
('b2c3d4e5-f6a7-8901-bcde-f12345678901', '天坛公园', '北京', '北京', '北京市东城区天坛东里甲1号', '明清两代皇帝祭天、祈谷的场所，是中国现存最大的古代祭祀性建筑群。', '古代祭祀建筑、回音壁、祈年殿', '建议购买联票，可参观主要景点', 34.00, '06:00-22:00', 39.882182, 116.406588, 'https://picsum.photos/400/300?random=2'),
('c3d4e5f6-a7b8-9012-cdef-123456789012', '颐和园', '北京', '北京', '北京市海淀区新建宫门路19号', '中国清朝时期皇家园林，前身为清漪园，坐落在北京西郊，与圆明园毗邻。', '皇家园林、昆明湖、万寿山、长廊', '园区较大，建议预留半天时间游览', 30.00, '06:00-20:00', 39.999982, 116.275461, 'https://picsum.photos/400/300?random=3'),
('d4e5f6a7-b8c9-0123-defa-234567890123', '八达岭长城', '北京', '北京', '北京市延庆区G6京藏高速58号出口', '万里长城的重要组成部分，是明长城的一个隘口，景色壮观，是世界文化遗产。', '世界文化遗产、雄伟长城、壮丽山景', '建议早上去，避开人流；穿舒适的鞋子', 40.00, '06:30-16:30', 40.359580, 116.019967, 'https://picsum.photos/400/300?random=4'),
('e5f6a7b8-c9d0-1234-efab-345678901234', '西湖风景名胜区', '浙江', '杭州', '浙江省杭州市西湖区龙井路1号', '中国大陆首批国家重点风景名胜区和中国十大风景名胜之一，以秀丽的湖光山色和众多的名胜古迹闻名中外。', '西湖十景、断桥残雪、雷峰塔、苏堤春晓', '春秋两季最佳，可骑行环湖游览', 0.00, '全天开放', 30.245560, 120.128590, 'https://picsum.photos/400/300?random=5'),
('f6a7b8c9-d0e1-2345-fabc-456789012345', '黄山风景区', '安徽', '黄山', '安徽省黄山市黄山区汤口镇', '世界文化与自然双重遗产，世界地质公园，国家5A级旅游景区，国家级风景名胜区。', '奇松、怪石、云海、温泉、冬雪', '建议住山上观日出，提前预订住宿', 190.00, '06:00-17:30', 30.133370, 118.167770, 'https://picsum.photos/400/300?random=6'),
('a7b8c9d0-e1f2-3456-abcd-567890123456', '秦始皇兵马俑博物馆', '陕西', '西安', '陕西省西安市临潼区秦陵北路', '世界第八大奇迹，是中国第一个封建皇帝秦始皇嬴政的陵园中一处大型从葬坑。', '兵马俑坑、铜车马、考古遗址', '建议请导游讲解，了解历史文化', 120.00, '08:30-17:00', 34.384150, 109.278470, 'https://picsum.photos/400/300?random=7'),
('b8c9d0e1-f2a3-4567-bcde-678901234567', '苏州园林（拙政园）', '江苏', '苏州', '江苏省苏州市姑苏区东北街178号', '中国四大名园之一，江南古典园林的代表作品，被誉为中国园林之母。', '古典园林、水景、假山、亭台楼阁', '建议淡季前往，体验更佳', 80.00, '07:30-17:30', 31.324060, 120.631860, 'https://picsum.photos/400/300?random=8'),
('c9d0e1f2-a3b4-5678-cdef-789012345678', '张家界国家森林公园', '湖南', '张家界', '湖南省张家界市武陵源区金鞭路279号', '中国第一个国家森林公园，以奇峰异石、幽谷秀水、林海莽原著称。', '奇峰异石、玻璃栈道、天门山、阿凡达取景地', '建议穿防滑鞋，带雨具', 225.00, '07:00-18:00', 29.325830, 110.438000, 'https://picsum.photos/400/300?random=9'),
('d0e1f2a3-b4c5-6789-defa-890123456789', '九寨沟风景区', '四川', '阿坝', '四川省阿坝藏族羌族自治州九寨沟县漳扎镇', '世界自然遗产、国家重点风景名胜区、国家5A级旅游景区、国家级自然保护区。', '彩池、叠瀑、雪峰、藏情、蓝冰', '秋季最美，但游客也最多，需提前规划', 169.00, '07:30-17:00', 33.260030, 103.918600, 'https://picsum.photos/400/300?random=10');

-- ============================================
-- 11. 授予权限
-- ============================================

-- 授予 anon 和 authenticated 角色访问权限
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 注意：需要在 Supabase Dashboard 中配置 Storage 存储桶的访问权限
-- 1. 创建 'images' 存储桶
-- 2. 设置存储桶为 public
-- 3. 配置上传策略允许 authenticated 用户上传图片
