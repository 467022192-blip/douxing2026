-- 修复外键关联问题，让 Supabase 能正确识别前端的连表查询
DO $$
BEGIN
    ALTER TABLE IF EXISTS posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
    ALTER TABLE IF EXISTS posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE IF EXISTS likes DROP CONSTRAINT IF EXISTS likes_user_id_fkey;
    ALTER TABLE IF EXISTS likes ADD CONSTRAINT likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE IF EXISTS comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
    ALTER TABLE IF EXISTS comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 强制刷新缓存
NOTIFY pgrst, 'reload schema';