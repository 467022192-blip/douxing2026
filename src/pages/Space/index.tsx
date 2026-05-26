import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Heart, MessageCircle, MapPin, Image as ImageIcon, X, Send, Camera, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getPosts, getComments, addComment, createPost, uploadImage, checkLike, addLike, removeLike, deletePost, getAttractions } from '../../services/supabaseService';
import type { Post, Comment, Attraction } from '../../types';
import ImagePreviewModal from '../../components/ImagePreviewModal';

export default function Space() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 10;
  
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState('');
  
  const { user, isAuthenticated } = useAuthStore();

  // 发布动态相关状态
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState<string>('');
  const [postContent, setPostContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAttractionListOpen, setIsAttractionListOpen] = useState(false);

  const [imagePreview, setImagePreview] = useState<{ open: boolean; images: string[]; index: number }>({
    open: false,
    images: [],
    index: 0
  });

  const [allAttractions, setAllAttractions] = useState<Attraction[]>([]);
  const [attractionQuery, setAttractionQuery] = useState('');
  const [isLoadingAttractions, setIsLoadingAttractions] = useState(false);

  const fetchPostsData = useCallback(async (pageNum: number, isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else if (pageNum === 1) {
        setIsLoadingPosts(true);
      } else {
        setIsLoadingMore(true);
      }
      
      const data = await getPosts(pageNum, PAGE_SIZE);
      
      if (data.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      
      let finalPosts = data;
      // Load like status for current user if authenticated
      if (isAuthenticated && user) {
        finalPosts = await Promise.all(
          data.map(async (post) => {
            const isLiked = await checkLike(post.id, user.id);
            return { ...post, is_liked: isLiked };
          })
        );
      }
      
      if (isRefresh || pageNum === 1) {
        setPosts(finalPosts);
      } else {
        setPosts(prev => {
          // Filter out duplicates just in case
          const newPosts = finalPosts.filter(p => !prev.some(ep => ep.id === p.id));
          return [...prev, ...newPosts];
        });
      }
    } catch (error) {
      console.error('获取动态失败:', error);
    } finally {
      setIsLoadingPosts(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    setPage(1);
    fetchPostsData(1);
  }, [isAuthenticated, user, fetchPostsData]);

  const handleRefresh = () => {
    setPage(1);
    fetchPostsData(1, true);
  };

  const handleLoadMore = () => {
    if (!hasMore || isLoadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPostsData(nextPage);
  };

  const filteredAttractions = useMemo(() => {
    const q = attractionQuery.trim().toLowerCase();
    const src = Array.isArray(allAttractions) ? allAttractions : [];
    if (!q) return src;
    return src.filter((a) => {
      const hay = `${a.name} ${a.short_name || ''} ${a.address || ''} ${a.city || ''} ${a.province || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [allAttractions, attractionQuery]);

  const attractionOptions = useMemo(() => filteredAttractions.slice(0, 20), [filteredAttractions]);

  const handleLike = async (post: Post) => {
    if (!isAuthenticated || !user) {
      alert('请先登录后再点赞');
      return;
    }

    try {
      // 乐观更新
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                is_liked: !p.is_liked,
                likes_count: p.is_liked
                  ? (p.likes_count || 0) - 1
                  : (p.likes_count || 0) + 1,
              }
            : p
        )
      );

      if (post.is_liked) {
        await removeLike(post.id, user.id);
      } else {
        await addLike(post.id, user.id);
      }
    } catch (error) {
      console.error('操作点赞失败:', error);
      // 回滚状态
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? post : p
        )
      );
    }
  };

  const openComments = async (post: Post) => {
    setSelectedPost(post);
    try {
      setIsLoadingComments(true);
      const data = await getComments(post.id);
      setComments(data);
    } catch (error) {
      console.error('获取评论失败:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const submitComment = async () => {
    if (!newComment.trim() || !selectedPost || !user) return;

    try {
      const commentData = await addComment({
        post_id: selectedPost.id,
        user_id: user.id,
        content: newComment,
      });

      setComments((prev) => [...prev, commentData]);
      setNewComment('');

      setPosts((prev) =>
        prev.map((post) =>
          post.id === selectedPost.id
            ? { ...post, comments_count: (post.comments_count || 0) + 1 }
            : post
        )
      );
    } catch (error) {
      console.error('发布评论失败:', error);
      alert('发布评论失败，请重试');
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 9 - selectedFiles.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newUrls = filesToProcess.map((file) => URL.createObjectURL(file));
    
    setSelectedFiles((prev) => [...prev, ...filesToProcess]);
    setPreviewUrls((prev) => [...prev, ...newUrls]);
    
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImageClick = (e: React.MouseEvent, post: Post, imageIndex: number) => {
    e.stopPropagation();
    const raw = (post as any).images;
    const imgs = (Array.isArray(raw) ? raw : []).filter(Boolean);
    if (!imgs.length) return;
    setImagePreview({ open: true, images: imgs, index: Math.max(0, Math.min(imageIndex, imgs.length - 1)) });
  };

  const submitPost = async () => {
    if (!postContent.trim() && selectedFiles.length === 0) return;
    if (!selectedAttraction || !user) return;

    try {
      setIsSubmitting(true);
      
      const imageUrls: string[] = [];
      for (const file of selectedFiles) {
        const url = await uploadImage(file, user.id);
        imageUrls.push(url);
      }

      const newPost = await createPost({
        user_id: user.id,
        attraction_id: selectedAttraction,
        content: postContent,
        images: imageUrls,
        is_private: isPrivate,
      });

      setPosts((prev) => [{ ...newPost, is_liked: false, likes_count: 0, comments_count: 0 }, ...prev]);
      closeCreateModal();
    } catch (error: unknown) {
      console.error('发布动态失败:', error);
      const message = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`发布动态失败，请重试\n${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setPostContent('');
    previewUrls.forEach(URL.revokeObjectURL);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setSelectedAttraction('');
    setIsPrivate(false);
    setAttractionQuery('');
    setIsAttractionListOpen(false);
  };

  const openCreateModal = async () => {
    if (!isAuthenticated) {
      if (window.confirm('请先登录后再发布，是否前往登录？')) {
        navigate('/login');
      }
      return;
    }

    setIsCreateModalOpen(true);

    if (allAttractions.length === 0) {
      try {
        setIsLoadingAttractions(true);
        const attractions = await getAttractions();
        setAllAttractions(Array.isArray(attractions) ? attractions : []);
      } catch (error) {
        console.error('加载景区列表失败:', error);
      } finally {
        setIsLoadingAttractions(false);
      }
    }
  };

  const handleDeletePost = async (post: Post) => {
    if (!isAuthenticated || !user) {
      alert('请先登录');
      return;
    }
    if (post.user_id !== user.id) return;
    if (!window.confirm('确定删除这条动态吗？')) return;

    try {
      await deletePost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      if (selectedPost?.id === post.id) {
        setSelectedPost(null);
      }
    } catch (error) {
      console.error('删除动态失败:', error);
      alert('删除失败，请重试');
    }
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    if (Number.isNaN(date.getTime())) return '';
    const mm = String(date.getMinutes()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    return `${date.getMonth() + 1}月${date.getDate()}日${hh}:${mm}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 头部 */}
      <div className="bg-white px-4 py-3 sticky top-0 z-10 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-gray-900">行程所至，自有故事</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-gray-100 transition-colors"
            aria-label="更新"
          >
            <RefreshCw className={`w-[18px] h-[18px] sm:w-4 sm:h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <button
          onClick={openCreateModal}
          className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${isAuthenticated ? 'text-gray-900' : 'text-gray-400'}`}
          aria-label="发布"
        >
          <Camera className="w-[30px] h-[30px] sm:w-7 sm:h-7" />
        </button>
      </div>

      {/* 刷新状态指示器 */}
      {isRefreshing && (
        <div className="flex justify-center py-2 bg-white/80 backdrop-blur-sm fixed w-full z-10 top-14 shadow-sm">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
        </div>
      )}

      {/* 动态列表 */}
      <div className="space-y-2 mt-2">
        {isLoadingPosts ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
            <p>加载动态中...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera size={32} className="text-gray-400" />
            </div>
            <p className="text-gray-500">先去打卡一些景区，然后回来分享你的旅行故事吧！</p>
            <button
              onClick={openCreateModal}
              className={`mt-4 px-5 py-2 rounded-full text-sm inline-flex items-center gap-2 ${
                isAuthenticated ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              <Camera size={18} />
              发布
            </button>
          </div>
        ) : (
          (posts || []).map((post) => (
            <div key={post.id} className="bg-white p-4">
              {/* 用户信息 */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                  {post.user?.avatar_url ? (
                    <img
                      src={post.user.avatar_url}
                      alt={post.user.nickname}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <ImageIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{post.user?.nickname}</div>
                  <div className="text-xs text-gray-500">{formatTime(post.created_at || '')}</div>
                </div>
                {isAuthenticated && user && post.user_id === user.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeletePost(post);
                    }}
                    className="p-2 -mr-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                    aria-label="删除"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {/* 内容 */}
              <p className="text-gray-800 mb-3">{post.content}</p>

              {/* 图片 */}
              {Array.isArray((post as any).images) && (post as any).images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(post as any).images.map((image: string, idx: number) => (
                    <div 
                      key={idx} 
                      className="relative aspect-square cursor-pointer overflow-hidden rounded-lg"
                      onClick={(e) => handleImageClick(e, post, idx)}
                    >
                      <img
                        src={image}
                        alt={`图片${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 景区信息 */}
              <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                <MapPin size={14} className="text-emerald-600" />
                <span className="text-gray-700">{post.attraction?.name}</span>
              </div>

              {/* 互动按钮 */}
              <div className="flex items-center gap-6 pt-3 border-t border-gray-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(post);
                  }}
                  className={`flex items-center gap-1.5 text-sm ${
                    post.is_liked ? 'text-red-500' : 'text-gray-500'
                  }`}
                >
                  <Heart
                    size={18}
                    fill={post.is_liked ? 'currentColor' : 'none'}
                  />
                  <span>{post.likes_count || 0}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openComments(post);
                  }}
                  className="flex items-center gap-1.5 text-sm text-gray-500"
                >
                  <MessageCircle size={18} />
                  <span>{post.comments_count || 0}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 加载更多 */}
      {!isLoadingPosts && posts.length > 0 && (
        <div className="py-6 text-center">
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 bg-white text-emerald-500 rounded-full shadow-sm text-sm border border-emerald-100 disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoadingMore ? '加载中...' : '加载更多'}
            </button>
          ) : (
            <span className="text-gray-400 text-sm">已经到底啦~</span>
          )}
        </div>
      )}

      {null}

      <ImagePreviewModal
        open={imagePreview.open}
        images={imagePreview.images}
        initialIndex={imagePreview.index}
        onClose={() => setImagePreview({ open: false, images: [], index: 0 })}
      />

      {/* 评论弹窗 */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedPost(null);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">
                评论 ({selectedPost.comments_count || 0})
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPost(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* 评论列表 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoadingComments ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                  <p>暂无评论，来说点什么吧</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-medium">
                      {comment.user?.nickname?.[0] || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {comment.user?.nickname}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatTime(comment.created_at || '')}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm mt-1">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 评论输入 */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={isAuthenticated ? "写评论..." : "请先登录..."}
                  disabled={!isAuthenticated}
                  className="flex-1 px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  onKeyPress={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      submitComment();
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    submitComment();
                  }}
                  disabled={!newComment.trim() || !isAuthenticated}
                  className="p-2 bg-emerald-500 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 发布动态弹窗 */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black bg-opacity-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <div
            className="bg-white w-full max-w-md rounded-t-2xl h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">发布动态</h3>
              <button
                onClick={closeCreateModal}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* 内容区域 */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* 选择景区 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  选择打卡地点 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={attractionQuery}
                    onChange={(e) => {
                      setAttractionQuery(e.target.value);
                      setIsAttractionListOpen(true);
                      setSelectedAttraction('');
                    }}
                    onFocus={() => setIsAttractionListOpen(true)}
                    placeholder="搜索景区名称或地址..."
                    className="w-full px-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  {isAttractionListOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-20">
                      {isLoadingAttractions ? (
                        <div className="px-3 py-3 text-sm text-gray-500">加载景区中...</div>
                      ) : !attractionQuery.trim() ? (
                        <div className="px-3 py-3 text-sm text-gray-500">输入景区名称或地址进行搜索</div>
                      ) : attractionOptions.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-gray-500">未找到匹配景区</div>
                      ) : (
                        attractionOptions.map((attraction) => (
                          <button
                            key={attraction.id}
                            type="button"
                            onClick={() => {
                              setSelectedAttraction(attraction.id);
                              setAttractionQuery(attraction.name);
                              setIsAttractionListOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                          >
                            <div className="text-sm font-medium text-gray-900">{attraction.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">
                              {(attraction.address || `${attraction.province || ''}·${attraction.city || ''}`).replace(/\s+/g, ' ').trim()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 文字输入 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  分享你的旅行故事
                </label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="写下你的旅行感受..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                />
              </div>

              {/* 图片上传 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  上传图片
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {/* 已选择的图片 */}
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={url}
                        alt={`已选图片${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removeImage(index)}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {/* 添加图片按钮 */}
                  {previewUrls.length < 9 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                    >
                      <Camera size={24} />
                      <span className="text-xs mt-1">{previewUrls.length}/9</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              {/* 隐私设置 */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-700">仅自己可见</p>
                  <p className="text-xs text-gray-500">开启后只有你能看到这条动态</p>
                </div>
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className={`w-11 h-6 rounded-full transition-colors ${
                    isPrivate ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                      isPrivate ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="p-4 border-t">
              <button
                onClick={submitPost}
                disabled={isSubmitting || !selectedAttraction || (!postContent.trim() && selectedFiles.length === 0)}
                className="w-full py-3 bg-emerald-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    发布中...
                  </>
                ) : (
                  '发布'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
