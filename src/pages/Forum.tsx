import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Heart, Share2, Plus, Clock, User as UserIcon, ArrowLeft, Save, X, Send, Edit3 } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { uploadImageToCDNs, getImageUrl } from '../services/imageService';
import { apiDelete, apiGet, apiPost, apiPut } from '../lib/apiClient';

type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

const toDateValue = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDate = (value: string | null | undefined, pattern: string) => {
  const parsed = toDateValue(value);
  return parsed ? format(parsed, pattern) : '刚刚';
};

const getStatusText = (status?: ContentStatus) => {
  if (status === 'pending') return '待审核';
  if (status === 'rejected') return '已驳回';
  if (status === 'draft') return '草稿';
  return '已发布';
};

type PostItem = {
  id: string;
  title: string;
  section: string;
  content: string;
  tags?: string[];
  authorUid: string;
  status?: ContentStatus;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  likedByMe?: boolean;
  favoritedByMe?: boolean;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  updatedAt: string;
};

type SectionItem = {
  id: string;
  name: string;
  description?: string;
  order: number;
};

type CommentItem = {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string | null;
  content: string;
  parentId: string | null;
  createdAt: string;
};

const PostList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = searchParams.get('section') || 'all';
  const sort = searchParams.get('sort') || 'latest';
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isBanned } = useAuth();

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const data = await apiGet<{ sections: SectionItem[] }>('/api/sections');
        setSections(data.sections || []);
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };

    fetchSections();
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);
        const data = await apiGet<{ posts: PostItem[] }>('/api/posts', {
          section,
          sort,
        });
        setPosts(data.posts || []);
      } catch (error) {
        console.error('Error fetching posts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [section, sort]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-serif font-bold text-gray-900 mb-2">社区论坛</h1>
          <p className="text-gray-500 italic">诗扶社区 · 与同好分享你的热爱</p>
        </div>
        {user && !isBanned && (
          <Link to="/forum/new" className="px-6 py-3 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-md">
            <Plus size={18} /> 发布帖子
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          to="/forum?section=all"
          className={clsx(
            'px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize',
            section === 'all'
              ? 'bg-brand-primary text-gray-900 border-brand-primary'
              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-primary hover:text-brand-primary',
          )}
        >
          全部板块
        </Link>
        {sections.map((sec) => (
          <Link
            key={sec.id}
            to={`/forum?section=${sec.id}`}
            className={clsx(
              'px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize',
              section === sec.id
                ? 'bg-brand-primary text-gray-900 border-brand-primary'
                : 'bg-white text-gray-500 border-gray-200 hover:border-brand-primary hover:text-brand-primary',
            )}
          >
            {sec.name}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-12 border-b border-gray-100">
        {(['latest', 'hot', 'recommended'] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              const params = new URLSearchParams(searchParams);
              params.set('sort', s);
              setSearchParams(params);
            }}
            className={clsx(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              sort === s
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-gray-400 hover:text-gray-600',
            )}
          >
            {s === 'latest' ? '最新' : s === 'hot' ? '热门' : '推荐'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-white rounded-3xl animate-pulse border border-gray-100"></div>
          ))}
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/forum/${post.id}`}
              className="block bg-white p-8 rounded-[32px] border border-gray-100 hover:border-brand-primary/20 hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="px-2 py-1 bg-brand-primary/10 text-brand-primary text-[10px] font-bold uppercase tracking-wider rounded">
                  {sections.find((s) => s.id === post.section)?.name || post.section}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 text-xs flex items-center gap-1">
                  <Clock size={12} /> {formatDate(post.updatedAt, 'yyyy-MM-dd')}
                </span>
                {post.status && post.status !== 'published' && (
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider',
                    post.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : post.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600',
                  )}>
                    {getStatusText(post.status)}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-serif font-bold mb-3 group-hover:text-brand-primary transition-colors">{post.title}</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6 text-gray-400 text-sm">
                  <span className="flex items-center gap-1.5"><Heart size={16} /> {post.likesCount || 0}</span>
                  <span className="flex items-center gap-1.5"><MessageSquare size={16} /> {post.commentsCount || 0}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden">
                    <UserIcon size={14} className="m-auto text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-500">作者 ID: {post.authorUid?.substring(0, 6)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[40px] border border-gray-100 text-center">
          <MessageSquare size={48} className="mx-auto text-gray-200 mb-6" />
          <p className="text-gray-400 italic">暂无帖子，快来发布第一个讨论吧！</p>
        </div>
      )}
    </div>
  );
};

const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState<PostItem | null>(null);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [liking, setLiking] = useState(false);
  const { user, isBanned } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const data = await apiGet<{ sections: SectionItem[] }>('/api/sections');
        setSections(data.sections || []);
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };

    fetchSections();
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      if (!postId) return;
      try {
        setLoading(true);
        const data = await apiGet<{ post: PostItem; comments: CommentItem[] }>(`/api/posts/${postId}`);
        setPost(data.post);
        setComments(data.comments || []);
      } catch (error) {
        console.error('Error fetching post:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId || !user || !newComment.trim()) return;
    if (isBanned) {
      alert('账号已被封禁，无法评论');
      return;
    }
    if (!canComment) {
      alert('仅已发布内容可评论');
      return;
    }

    try {
      const data = await apiPost<{ comment: CommentItem }>(`/api/posts/${postId}/comments`, {
        content: newComment,
        parentId: replyTo?.id || null,
      });

      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setPost((prev) => prev ? { ...prev, commentsCount: (prev.commentsCount || 0) + 1 } : prev);
      }

      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('发表评论失败，请稍后重试');
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">加载中...</div>;
  if (!post) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">帖子未找到</div>;

  const rootComments = comments.filter((c) => !c.parentId);
  const getReplies = (parentId: string) => comments.filter((c) => c.parentId === parentId);

  const isOwner = Boolean(user && post && post.authorUid === user.uid);
  const canSubmitReview = Boolean(!isBanned && isOwner && post && (post.status === 'draft' || post.status === 'rejected'));
  const canEditPost = Boolean(!isBanned && isOwner);
  const canComment = post.status === 'published';

  const handleToggleLike = async () => {
    if (!post || !postId || !user || liking) return;
    setLiking(true);
    try {
      if (post.likedByMe) {
        const data = await apiDelete<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`);
        setPost((prev) => (prev ? { ...prev, likedByMe: data.liked, likesCount: data.likesCount } : prev));
      } else {
        const data = await apiPost<{ liked: boolean; likesCount: number }>(`/api/posts/${postId}/like`);
        setPost((prev) => (prev ? { ...prev, likedByMe: data.liked, likesCount: data.likesCount } : prev));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      alert('操作失败，请稍后重试');
    } finally {
      setLiking(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!post || !postId || !user || favoriting) return;
    setFavoriting(true);
    try {
      if (post.favoritedByMe) {
        await apiDelete(`/api/favorites/post/${postId}`);
        setPost((prev) => (prev ? { ...prev, favoritedByMe: false } : prev));
      } else {
        await apiPost('/api/favorites', { targetType: 'post', targetId: postId });
        setPost((prev) => (prev ? { ...prev, favoritedByMe: true } : prev));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      alert('收藏操作失败，请稍后重试');
    } finally {
      setFavoriting(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!post || !postId || !canSubmitReview || submittingReview) return;
    setSubmittingReview(true);
    try {
      const data = await apiPost<{ post: PostItem }>(`/api/posts/${postId}/submit`);
      setPost((prev) => (prev ? { ...prev, ...data.post } : prev));
      alert('已提交审核，请等待管理员处理');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('提交审核失败，请稍后重试');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleShare = async () => {
    if (!postId) return;
    const url = `${window.location.origin}/forum/${postId}`;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('链接已复制，可直接分享给好友');
    } catch (error) {
      console.error('Share copy failed:', error);
      alert('复制链接失败，请手动复制地址栏链接');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-primary mb-8 transition-colors">
        <ArrowLeft size={18} /> 返回
      </button>

      <article className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm mb-8">
        <header className="mb-8 border-b border-gray-100 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-widest rounded-full">
              {sections.find((s) => s.id === post.section)?.name || post.section}
            </span>
            <span className="text-gray-400 text-sm flex items-center gap-1"><Clock size={14} /> {formatDate(post.createdAt, 'yyyy-MM-dd HH:mm')}</span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-6">{post.title}</h1>
          <div className="mb-4 flex flex-wrap gap-2">
            <span className={clsx(
              'px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
              post.status === 'published'
                ? 'bg-green-100 text-green-700'
                : post.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : post.status === 'rejected'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600',
            )}>
              {getStatusText(post.status)}
            </span>
            {post.status === 'rejected' && post.reviewNote ? (
              <span className="text-xs text-red-500">驳回原因：{post.reviewNote}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
              <UserIcon size={20} className="m-auto text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">作者 ID: {post.authorUid?.substring(0, 8)}</p>
              <p className="text-xs text-gray-400">活跃粉丝</p>
            </div>
          </div>
        </header>

        <div className="prose prose-lg prose-stone max-w-none font-sans leading-relaxed text-gray-700 mb-12">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        <div className="flex items-center gap-6 pt-8 border-t border-gray-100">
          <button
            onClick={handleToggleLike}
            disabled={!user || liking}
            className={clsx(
              'flex items-center gap-2 transition-colors',
              post.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500',
              (!user || liking) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Heart size={20} /> {post.likesCount || 0}
          </button>
          <button
            onClick={handleToggleFavorite}
            disabled={!user || favoriting}
            className={clsx(
              'flex items-center gap-2 transition-colors',
              post.favoritedByMe ? 'text-brand-primary' : 'text-gray-400 hover:text-brand-primary',
              (!user || favoriting) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Save size={20} /> {post.favoritedByMe ? '已收藏' : '收藏'}
          </button>
          <button onClick={handleShare} className="flex items-center gap-2 text-gray-400 hover:text-brand-primary transition-colors">
            <Share2 size={20} /> 分享
          </button>
          {canEditPost && (
            <Link to={`/forum/${post.id}/edit`} className="flex items-center gap-2 text-gray-400 hover:text-brand-primary transition-colors">
              <Edit3 size={20} /> 编辑
            </Link>
          )}
          {canSubmitReview && (
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview}
              className="ml-auto px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-xs font-bold hover:bg-amber-200 disabled:opacity-50"
            >
              {submittingReview ? '提交中...' : '提交审核'}
            </button>
          )}
        </div>
      </article>

      <section className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm">
        <h3 className="text-2xl font-serif font-bold text-gray-900 mb-8">评论 ({comments.length})</h3>

        {user ? (
          <form onSubmit={handleAddComment} className="mb-12">
            {replyTo && (
              <div className="mb-4 px-4 py-2 bg-brand-primary/10 rounded-xl flex items-center justify-between">
                <span className="text-xs text-brand-primary">回复 @{replyTo.authorName}</span>
                <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
              </div>
            )}
            <div className="relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? `回复 @${replyTo.authorName}...` : '发表你的看法...'}
                rows={3}
                disabled={!canComment || isBanned}
                className="w-full px-6 py-4 bg-brand-cream rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
              />
              <button
                type="submit"
                disabled={!canComment || isBanned}
                className="absolute bottom-4 right-4 p-3 bg-brand-primary text-gray-900 rounded-full hover:scale-105 transition-all shadow-md"
              >
                <Send size={18} />
              </button>
            </div>
            {isBanned ? (
              <p className="mt-3 text-xs text-red-500">账号已被封禁，无法评论</p>
            ) : !canComment ? (
              <p className="mt-3 text-xs text-amber-600">仅已发布内容可评论</p>
            ) : null}
          </form>
        ) : (
          <div className="p-8 bg-brand-cream rounded-3xl text-center mb-12">
            <p className="text-gray-500 text-sm">请先登录后发表评论</p>
          </div>
        )}

        <div className="space-y-8">
          {rootComments.length > 0 ? rootComments.map((comment) => (
            <div key={comment.id} className="space-y-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                  <img src={comment.authorPhoto || 'https://picsum.photos/seed/user/100/100'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">{comment.authorName || '匿名用户'}</span>
                    <span className="text-[10px] text-gray-400">{formatDate(comment.createdAt, 'MM-dd HH:mm')}</span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-2">{comment.content}</p>
                  <button
                    onClick={() => {
                      setReplyTo(comment);
                      const form = document.querySelector('form');
                      const top = form?.getBoundingClientRect().top ? window.scrollY + form.getBoundingClientRect().top - 200 : 0;
                      window.scrollTo({ top, behavior: 'smooth' });
                    }}
                    className="text-[10px] font-bold text-brand-primary hover:underline"
                  >
                    回复
                  </button>
                </div>
              </div>

              {getReplies(comment.id).length > 0 && (
                <div className="ml-14 space-y-4 border-l-2 border-brand-primary/20 pl-6">
                  {getReplies(comment.id).map((reply) => (
                    <div key={reply.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                        <img src={reply.authorPhoto || 'https://picsum.photos/seed/user/100/100'} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-700">{reply.authorName || '匿名用户'}</span>
                          <span className="text-[10px] text-gray-400">{formatDate(reply.createdAt, 'MM-dd HH:mm')}</span>
                        </div>
                        <p className="text-gray-600 text-xs leading-relaxed">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <p className="text-center text-gray-400 italic py-8">暂无评论，快来抢沙发吧！</p>
          )}
        </div>
      </section>
    </div>
  );
};

const PostEditor = () => {
  const { postId } = useParams();
  const isEditing = Boolean(postId);
  const navigate = useNavigate();
  const { user, isBanned, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    section: '',
    content: '',
    tags: '',
  });
  const [savingMode, setSavingMode] = useState<'draft' | 'pending' | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);

  useEffect(() => {
    const fetchSections = async () => {
      try {
        const data = await apiGet<{ sections: SectionItem[] }>('/api/sections');
        const fetchedSections = data.sections || [];
        setSections(fetchedSections);
        if (fetchedSections.length > 0) {
          setFormData((prev) => (prev.section ? prev : { ...prev, section: fetchedSections[0].id }));
        }
      } catch (error) {
        console.error('Error fetching sections:', error);
      }
    };

    fetchSections();
  }, []);

  useEffect(() => {
    const fetchEditingPost = async () => {
      if (!postId || !isEditing || authLoading) return;
      try {
        setLoadingPost(true);
        const data = await apiGet<{ post: PostItem }>(`/api/posts/${postId}`);
        if (!data.post) {
          alert('帖子不存在或无权编辑');
          navigate('/forum');
          return;
        }

        if (!user || data.post.authorUid !== user.uid) {
          alert('你无权编辑此帖子');
          navigate(`/forum/${postId}`);
          return;
        }

        setFormData({
          title: data.post.title,
          section: data.post.section,
          content: data.post.content,
          tags: (data.post.tags || []).join(', '),
        });
      } catch (error) {
        console.error('Error loading editable post:', error);
        alert('加载帖子失败，请稍后重试');
        navigate('/forum');
      } finally {
        setLoadingPost(false);
      }
    };

    fetchEditingPost();
  }, [authLoading, isEditing, navigate, postId, user]);

  const handleSubmit = async (status: 'draft' | 'pending') => {
    if (!user) return;
    if (isBanned) {
      alert('账号已被封禁，无法发帖');
      return;
    }
    setSavingMode(status);

    try {
      const payload = {
        title: formData.title,
        section: formData.section,
        content: formData.content,
        tags: formData.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status,
      };

      const data = isEditing && postId
        ? await apiPut<{ post: PostItem }>(`/api/posts/${postId}`, payload)
        : await apiPost<{ post: PostItem }>('/api/posts', payload);

      navigate(`/forum/${data.post.id}`);
    } catch (error) {
      console.error('Error creating post:', error);
      alert(status === 'draft' ? '保存失败，请稍后重试' : '提交审核失败，请稍后重试');
    } finally {
      setSavingMode(null);
    }
  };

  if (loadingPost) {
    return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">加载中...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">{isEditing ? '编辑帖子' : '发布新帖子'}</h1>
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit('pending');
          }}
          className="space-y-8"
        >
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">标题</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="输入一个吸引人的标题..."
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-primary/20 font-serif text-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">板块</label>
            <select
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-primary/20 font-serif text-xl appearance-none"
            >
              {sections.map((sec) => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">标签 (逗号分隔)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="例如：Live, 绝色, 2024"
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">内容 (Markdown)</label>
            <div className="border border-gray-100 rounded-[32px] overflow-hidden">
              <MdEditor
                style={{ height: '400px' }}
                renderHTML={(text) => mdParser.render(text)}
                value={formData.content}
                onChange={({ text }) => setFormData({ ...formData, content: text })}
                onImageUpload={async (file) => {
                  const imageId = await uploadImageToCDNs(file);
                  const urls = await getImageUrl(imageId);
                  return urls[0] || '';
                }}
                placeholder="分享你的想法..."
                config={{
                  view: {
                    menu: true,
                    md: true,
                    html: false,
                  },
                  canView: {
                    menu: true,
                    md: true,
                    html: true,
                    fullScreen: true,
                    hideMenu: false,
                  },
                }}
              />
            </div>
          </div>

          <div className="pt-8 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              disabled={Boolean(savingMode)}
              className="px-8 py-4 bg-gray-100 text-gray-700 rounded-full font-bold hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} /> {savingMode === 'draft' ? '保存中...' : '保存草稿'}
            </button>
            <button
              type="submit"
              disabled={Boolean(savingMode)}
              className="px-12 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={20} /> {savingMode === 'pending' ? '提交中...' : '提交审核'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Forum = () => {
  return (
    <Routes>
      <Route path="/" element={<PostList />} />
      <Route path="/new" element={<PostEditor />} />
      <Route path="/:postId/edit" element={<PostEditor />} />
      <Route path="/:postId" element={<PostDetail />} />
    </Routes>
  );
};

export default Forum;
