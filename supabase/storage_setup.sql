-- ============================================
-- 配置 Supabase Storage (对象存储)
-- 运行此脚本创建 avatars 和 posts 存储桶并配置权限
-- ============================================

-- 1. 创建 avatars 存储桶 (如果不存在)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建 posts 存储桶 (如果不存在)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

-- 3. 配置 avatars 存储桶的 RLS 策略
-- 允许所有人读取头像
CREATE POLICY "Avatar images are publicly accessible." ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 允许已登录用户上传头像
CREATE POLICY "Anyone can upload an avatar." ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- 允许用户更新自己的头像
CREATE POLICY "Anyone can update their avatar." ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- 4. 配置 posts 存储桶的 RLS 策略
-- 允许所有人读取动态图片
CREATE POLICY "Post images are publicly accessible." ON storage.objects
  FOR SELECT USING (bucket_id = 'posts');

-- 允许已登录用户上传动态图片
CREATE POLICY "Anyone can upload a post image." ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- 允许用户更新/删除自己的动态图片
CREATE POLICY "Anyone can update their post image." ON storage.objects
  FOR UPDATE USING (bucket_id = 'posts' AND auth.uid() = owner);
  
CREATE POLICY "Anyone can delete their post image." ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND auth.uid() = owner);
