-- 确保当 auth.users 创建新用户时，自动在 public.profiles 创建记录
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, nickname, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        split_part(NEW.email, '@', 1),
        'https://api.dicebear.com/7.x/avataaars/svg?seed=' || NEW.email
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 如果触发器已存在，先删除
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 修复历史遗留数据：将所有在 auth.users 中但不在 public.profiles 中的用户同步过来
INSERT INTO public.profiles (id, email, nickname, avatar_url)
SELECT 
    id, 
    email, 
    split_part(email, '@', 1),
    'https://api.dicebear.com/7.x/avataaars/svg?seed=' || email
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
