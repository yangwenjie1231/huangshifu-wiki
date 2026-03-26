import React, { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { format } from 'date-fns';
import MarkdownIt from 'markdown-it';
import MdEditor from 'react-markdown-editor-lite';
import { clsx } from 'clsx';
import { ArrowLeft, Book, Calendar, Edit3, GitBranch, GitPullRequest, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/apiClient';
import 'react-markdown-editor-lite/lib/index.css';

const mdParser = new MarkdownIt({ html: true, linkify: true, typographer: true });

type ContentStatus = 'draft' | 'pending' | 'published' | 'rejected';
type BranchStatus = 'draft' | 'pending_review' | 'merged' | 'rejected' | 'conflict';
type PrStatus = 'open' | 'merged' | 'rejected';

type WikiPage = {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  tags: string[];
  eventDate?: string | null;
  status: ContentStatus;
  updatedAt: string;
  createdAt: string;
  lastEditorUid: string;
  lastEditorName: string;
};

type WikiBranch = {
  id: string;
  pageSlug: string;
  editorUid: string;
  editorName: string;
  status: BranchStatus;
  latestRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
  page?: {
    slug: string;
    title: string;
    category: string;
  } | null;
};

type WikiRevision = {
  id: string;
  pageSlug: string;
  branchId?: string | null;
  title: string;
  content: string;
  slug?: string | null;
  category?: string | null;
  tags?: string[];
  eventDate?: string | null;
  editorUid: string;
  editorName: string;
  isAutoSave?: boolean;
  createdAt: string;
};

type WikiPullRequest = {
  id: string;
  branchId: string;
  pageSlug: string;
  title: string;
  description?: string | null;
  status: PrStatus;
  createdByUid: string;
  createdByName: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  mergedAt?: string | null;
  conflictData?: unknown;
  createdAt: string;
  updatedAt: string;
  branch?: WikiBranch | null;
  page?: {
    slug: string;
    title: string;
    category: string;
  } | null;
  comments?: {
    id: string;
    authorUid: string;
    authorName: string;
    content: string;
    createdAt: string;
  }[];
};

const toDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const fmt = (value?: string | null, pattern = 'yyyy-MM-dd HH:mm') => {
  const parsed = toDate(value);
  return parsed ? format(parsed, pattern) : 'N/A';
};

const categoryName = (category: string) => {
  if (category === 'biography') return '人物介绍';
  if (category === 'music') return '音乐作品';
  if (category === 'album') return '专辑一览';
  if (category === 'timeline') return '时间轴';
  if (category === 'event') return '活动记录';
  return category;
};

const statusLabel = (status: ContentStatus) => {
  if (status === 'draft') return '草稿';
  if (status === 'pending') return '待审';
  if (status === 'rejected') return '驳回';
  return '已发布';
};

const branchStatusLabel = (status: BranchStatus) => {
  if (status === 'draft') return '草稿';
  if (status === 'pending_review') return '待审核';
  if (status === 'merged') return '已合并';
  if (status === 'rejected') return '已驳回';
  return '冲突';
};

const prStatusLabel = (status: PrStatus) => {
  if (status === 'open') return '待处理';
  if (status === 'merged') return '已合并';
  return '已驳回';
};

const WikiMarkdown = ({ content }: { content: string }) => {
  const processedContent = content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, p1, p2) => {
    const display = String(p1).trim();
    const slug = p2 ? String(p2).trim() : String(p1).trim();
    return `[${display}](/wiki/${slug})`;
  });

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        a: ({ href, children, ...props }) => {
          if (href?.startsWith('/wiki/')) {
            return (
              <Link to={href} className="text-brand-olive font-bold hover:underline" {...props}>
                {children}
              </Link>
            );
          }
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-olive hover:underline" {...props}>
              {children}
            </a>
          );
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

const WikiList = () => {
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') || 'all';
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isBanned } = useAuth();

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ pages: WikiPage[] }>('/api/wiki', { category });
        if (active) setPages(data.pages || []);
      } catch (error) {
        console.error('Fetch wiki list failed:', error);
        if (active) setPages([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [category]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-serif font-bold text-brand-olive">百科全书</h1>
          <p className="text-gray-500">GitHub 风格协作：分支 + PR + 冲突处理</p>
        </div>
        <div className="flex items-center gap-2">
          {user && !isBanned ? (
            <>
              <Link to="/wiki/branches" className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-brand-olive">
                我的分支
              </Link>
              <Link to="/wiki/pull-requests" className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-700 hover:border-brand-olive">
                PR 列表
              </Link>
              <Link to="/wiki/new" className="px-4 py-2 rounded-full bg-brand-olive text-white hover:bg-brand-olive/90">
                新建页面
              </Link>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {['all', 'biography', 'music', 'album', 'timeline', 'event'].map((cat) => (
          <Link
            key={cat}
            to={`/wiki?category=${cat}`}
            className={clsx(
              'px-4 py-2 rounded-full border text-sm',
              cat === category ? 'bg-brand-olive text-white border-brand-olive' : 'bg-white text-gray-600 border-gray-200',
            )}
          >
            {cat === 'all' ? '全部' : categoryName(cat)}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="text-gray-500">加载中...</div>
      ) : pages.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map((page) => (
            <Link key={page.id} to={`/wiki/${page.slug}`} className="bg-white border border-gray-100 rounded-3xl p-6 hover:border-brand-olive/30">
              <div className="text-xs text-gray-500 mb-2">{categoryName(page.category)}</div>
              <h3 className="font-serif text-2xl font-bold text-gray-900 mb-3">{page.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-3">{(page.content || '').replace(/[#*`]/g, '').slice(0, 120)}</p>
              <div className="mt-4 text-xs text-gray-400">更新于 {fmt(page.updatedAt)}</div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-3xl p-10 text-center text-gray-400">暂无数据</div>
      )}
    </div>
  );
};

const WikiPageView = () => {
  const { slug } = useParams();
  const { user, isBanned } = useAuth();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const data = await apiGet<{ page: WikiPage }>(`/api/wiki/${slug}`);
        if (active) setPage(data.page || null);
      } catch (error) {
        console.error('Fetch wiki page failed:', error);
        if (active) setPage(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-gray-500">加载中...</div>;
  }
  if (!page) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-gray-500">页面不存在</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to="/wiki" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-olive mb-6">
        <ArrowLeft size={16} /> 返回列表
      </Link>
      <article className="bg-white border border-gray-100 rounded-3xl p-8 sm:p-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="font-serif text-4xl font-bold text-brand-olive">{page.title}</h1>
            <p className="text-sm text-gray-500 mt-2">
              {categoryName(page.category)} · {statusLabel(page.status)} · 更新于 {fmt(page.updatedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user && !isBanned ? (
              <>
                <Link
                  to={`/wiki/${page.slug}/edit`}
                  className="px-4 py-2 rounded-full bg-brand-olive text-white hover:bg-brand-olive/90 inline-flex items-center gap-2"
                >
                  <Edit3 size={16} /> 编辑分支
                </Link>
                <Link
                  to={`/wiki/${page.slug}/history`}
                  className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:border-brand-olive"
                >
                  历史
                </Link>
              </>
            ) : null}
          </div>
        </div>
        <div className="prose prose-stone max-w-none">
          <WikiMarkdown content={page.content || ''} />
        </div>
      </article>
    </div>
  );
};

const WikiEditor = () => {
  const { slug } = useParams();
  const isNew = !slug || slug === 'new';
  const navigate = useNavigate();
  const { user, profile, isBanned } = useAuth();

  const [pageSlug, setPageSlug] = useState<string>(slug || '');
  const [branch, setBranch] = useState<WikiBranch | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'biography',
    content: '',
    tags: '',
    eventDate: '',
  });
  const [saving, setSaving] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [prDescription, setPrDescription] = useState('');
  const [submittingPr, setSubmittingPr] = useState(false);

  const normalizedTags = useMemo(
    () => formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    [formData.tags],
  );

  const ensureBranch = async (targetSlug: string) => {
    const result = await apiPost<{ branch: WikiBranch }>(`/api/wiki/${targetSlug}/branches`);
    setBranch(result.branch);
    return result.branch;
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user || isBanned) return;

      if (isNew) {
        setFormData({ title: '', category: 'biography', content: '', tags: '', eventDate: '' });
        return;
      }

      try {
        const pageData = await apiGet<{ page: WikiPage }>(`/api/wiki/${slug}`);
        if (!pageData.page || !active) return;
        setPageSlug(pageData.page.slug);
        setFormData({
          title: pageData.page.title,
          category: pageData.page.category,
          content: pageData.page.content,
          tags: (pageData.page.tags || []).join(', '),
          eventDate: pageData.page.eventDate || '',
        });

        const b = await ensureBranch(pageData.page.slug);
        const detail = await apiGet<{ latestRevision: WikiRevision | null }>(`/api/wiki/branches/${b.id}`);
        if (detail.latestRevision && active) {
          setFormData({
            title: detail.latestRevision.title,
            category: detail.latestRevision.category || pageData.page.category,
            content: detail.latestRevision.content,
            tags: (detail.latestRevision.tags || []).join(', '),
            eventDate: detail.latestRevision.eventDate || '',
          });
        }
      } catch (error) {
        console.error('Load wiki editor failed:', error);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [isNew, slug, user, isBanned]);

  const saveRevision = async (isAutoSave: boolean) => {
    if (!user || isBanned) return;
    if (!formData.title.trim() || !formData.content.trim()) return;

    const targetSlug = (isNew ? (pageSlug || formData.title) : pageSlug || slug || formData.title)
      .trim()
      .toLowerCase()
      .replace(/[\\/]/g, '-')
      .replace(/\s+/g, '-');

    if (!targetSlug) return;

    if (isAutoSave) {
      setAutoSaving(true);
    } else {
      setSaving(true);
    }

    try {
      if (isNew) {
        const pageRes = await apiPost<{ page: WikiPage }>('/api/wiki', {
          slug: targetSlug,
          title: formData.title,
          category: formData.category,
          content: formData.content,
          tags: normalizedTags,
          eventDate: formData.eventDate || null,
          status: 'draft',
        });
        setPageSlug(pageRes.page.slug);
      }

      const ensured = branch || (await ensureBranch(targetSlug));
      await apiPost(`/api/wiki/branches/${ensured.id}/revisions`, {
        title: formData.title,
        content: formData.content,
        slug: targetSlug,
        category: formData.category,
        tags: normalizedTags,
        eventDate: formData.eventDate || null,
        isAutoSave,
      });
      setLastSavedAt(new Date().toISOString());
      if (isNew) {
        navigate(`/wiki/${targetSlug}/edit`, { replace: true });
      }
    } catch (error) {
      console.error('Save wiki revision failed:', error);
      if (!isAutoSave) {
        alert('保存失败，请稍后重试');
      }
    } finally {
      if (isAutoSave) {
        setAutoSaving(false);
      } else {
        setSaving(false);
      }
    }
  };

  useEffect(() => {
    if (!user || isBanned) return;
    const timer = window.setInterval(() => {
      void saveRevision(true);
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  });

  const submitPr = async () => {
    if (!branch || submittingPr) return;
    setSubmittingPr(true);
    try {
      await saveRevision(false);
      const latestBranch = branch || (await ensureBranch(pageSlug || slug || ''));
      const data = await apiPost<{ pullRequest: WikiPullRequest }>(`/api/wiki/branches/${latestBranch.id}/pull-request`, {
        title: formData.title,
        description: prDescription.trim() || null,
      });
      alert(`PR 已提交: ${data.pullRequest.id}`);
      navigate(`/wiki/pull-requests/${data.pullRequest.id}`);
    } catch (error) {
      console.error('Submit wiki PR failed:', error);
      alert('提交 PR 失败，请稍后重试');
    } finally {
      setSubmittingPr(false);
    }
  };

  if (!user) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-gray-500">请先登录后编辑百科</div>;
  }
  if (isBanned) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-red-500">账号已封禁，无法编辑百科</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="font-serif text-3xl font-bold text-brand-olive">{isNew ? '新建百科页面' : `编辑分支 · ${pageSlug}`}</h1>
          <div className="text-xs text-gray-500">
            {autoSaving ? '自动保存中...' : lastSavedAt ? `最近保存: ${fmt(lastSavedAt)}` : '尚未保存'}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <input
            value={formData.title}
            onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="标题"
            className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
          />
          <select
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
          >
            <option value="biography">人物介绍</option>
            <option value="music">音乐作品</option>
            <option value="album">专辑一览</option>
            <option value="timeline">时间轴</option>
            <option value="event">活动记录</option>
          </select>
          <input
            type="date"
            value={formData.eventDate}
            onChange={(e) => setFormData((prev) => ({ ...prev, eventDate: e.target.value }))}
            className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
          />
        </div>

        {isNew ? (
          <input
            value={pageSlug}
            onChange={(e) => setPageSlug(e.target.value)}
            placeholder="页面标识 slug（可留空自动由标题生成）"
            className="w-full px-4 py-3 rounded-2xl bg-brand-cream border-none mb-4"
          />
        ) : null}

        <input
          value={formData.tags}
          onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
          placeholder="标签，逗号分隔"
          className="w-full px-4 py-3 rounded-2xl bg-brand-cream border-none mb-4"
        />

        <div className="border border-gray-100 rounded-3xl overflow-hidden mb-4">
          <MdEditor
            style={{ height: '460px' }}
            renderHTML={(text) => mdParser.render(text)}
            value={formData.content}
            onChange={({ text }) => setFormData((prev) => ({ ...prev, content: text }))}
          />
        </div>

        <div className="bg-brand-cream/40 border border-brand-cream rounded-2xl p-4 mb-4">
          <div className="text-sm font-bold text-brand-olive mb-2">提交 PR（描述可选）</div>
          <textarea
            value={prDescription}
            onChange={(e) => setPrDescription(e.target.value)}
            placeholder="这次修改的说明（可选）"
            className="w-full min-h-[88px] px-3 py-2 rounded-xl border border-gray-200"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => void saveRevision(false)}
            disabled={saving}
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} /> {saving ? '保存中...' : '保存分支'}
          </button>
          <button
            onClick={() => void submitPr()}
            disabled={submittingPr}
            className="px-4 py-2 rounded-full bg-brand-olive text-white hover:bg-brand-olive/90 inline-flex items-center gap-2 disabled:opacity-50"
          >
            <GitPullRequest size={16} /> {submittingPr ? '提交中...' : '提交 PR'}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500">自动保存间隔：15 秒</div>
      </div>
    </div>
  );
};

const WikiHistory = () => {
  const { slug } = useParams();
  const [revisions, setRevisions] = useState<WikiRevision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        const data = await apiGet<{ revisions: WikiRevision[] }>(`/api/wiki/${slug}/history`);
        if (active) setRevisions(data.revisions || []);
      } catch (error) {
        console.error('Fetch wiki history failed:', error);
        if (active) setRevisions([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to={`/wiki/${slug}`} className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-olive mb-6">
        <ArrowLeft size={16} /> 返回页面
      </Link>
      <div className="bg-white border border-gray-100 rounded-3xl p-6">
        <h2 className="font-serif text-2xl font-bold text-brand-olive mb-4">历史版本</h2>
        {loading ? <div className="text-gray-500">加载中...</div> : null}
        {!loading && revisions.length === 0 ? <div className="text-gray-500">暂无历史记录</div> : null}
        <div className="space-y-3">
          {revisions.map((revision) => (
            <div key={revision.id} className="p-4 rounded-2xl bg-brand-cream/30 border border-brand-cream">
              <div className="text-sm font-bold text-gray-800">{revision.title}</div>
              <div className="text-xs text-gray-500 mt-1">
                {fmt(revision.createdAt)} · {revision.editorName}
                {revision.isAutoSave ? ' · 自动保存' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const WikiBranches = () => {
  const [branches, setBranches] = useState<WikiBranch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ branches: WikiBranch[] }>('/api/wiki/branches/mine');
        if (active) setBranches(data.branches || []);
      } catch (error) {
        console.error('Fetch wiki branches failed:', error);
        if (active) setBranches([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl font-bold text-brand-olive inline-flex items-center gap-2">
          <GitBranch size={24} /> 我的分支
        </h1>
        <Link to="/wiki" className="text-sm text-gray-600 hover:text-brand-olive">返回百科</Link>
      </div>
      {loading ? <div className="text-gray-500">加载中...</div> : null}
      {!loading && branches.length === 0 ? <div className="text-gray-500">暂无分支</div> : null}
      <div className="space-y-3">
        {branches.map((branch) => (
          <div key={branch.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-gray-800">{branch.page?.title || branch.pageSlug}</div>
              <div className="text-xs text-gray-500">
                {branch.pageSlug} · {branchStatusLabel(branch.status)} · 更新于 {fmt(branch.updatedAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/wiki/${branch.pageSlug}/edit`} className="px-3 py-1.5 rounded-full bg-brand-olive text-white text-sm">
                继续编辑
              </Link>
              {branch.status === 'conflict' ? (
                <Link to={`/wiki/branches/${branch.id}/conflict`} className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm">
                  解决冲突
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WikiPullRequests = () => {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState<PrStatus>('open');
  const [pullRequests, setPullRequests] = useState<WikiPullRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ pullRequests: WikiPullRequest[] }>('/api/wiki/pull-requests/list', { status });
        if (active) setPullRequests(data.pullRequests || []);
      } catch (error) {
        console.error('Fetch wiki pull requests failed:', error);
        if (active) setPullRequests([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [status]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="font-serif text-3xl font-bold text-brand-olive inline-flex items-center gap-2">
          <GitPullRequest size={24} /> {isAdmin ? 'Wiki PR 审核' : '我的 Wiki PR'}
        </h1>
        <div className="flex gap-2">
          {(['open', 'merged', 'rejected'] as PrStatus[]).map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={clsx(
                'px-3 py-1.5 rounded-full text-sm border',
                status === item ? 'bg-brand-olive text-white border-brand-olive' : 'bg-white text-gray-600 border-gray-200',
              )}
            >
              {prStatusLabel(item)}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-gray-500">加载中...</div> : null}
      {!loading && pullRequests.length === 0 ? <div className="text-gray-500">暂无 PR</div> : null}
      <div className="space-y-3">
        {pullRequests.map((pr) => (
          <Link key={pr.id} to={`/wiki/pull-requests/${pr.id}`} className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-brand-olive/30">
            <div className="font-bold text-gray-800">{pr.title}</div>
            <div className="text-xs text-gray-500 mt-1">
              {pr.page?.title || pr.pageSlug} · {prStatusLabel(pr.status)} · {pr.createdByName} · {fmt(pr.createdAt)}
            </div>
            {pr.description ? <div className="text-sm text-gray-600 mt-2 line-clamp-2">{pr.description}</div> : null}
          </Link>
        ))}
      </div>
    </div>
  );
};

const WikiPullRequestDetail = () => {
  const { prId } = useParams();
  const { user, isAdmin } = useAuth();
  const [pr, setPr] = useState<WikiPullRequest | null>(null);
  const [diff, setDiff] = useState<{
    base: { title: string; content: string; category: string; tags: string[]; eventDate?: string | null };
    head: { title: string; content: string; category: string; tags: string[]; eventDate?: string | null };
  } | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);

  const canReview = Boolean(isAdmin && pr?.status === 'open');

  const load = async () => {
    if (!prId) return;
    setLoading(true);
    try {
      const [prData, diffData] = await Promise.all([
        apiGet<{ pullRequest: WikiPullRequest }>(`/api/wiki/pull-requests/${prId}`),
        apiGet<{ diff: any }>(`/api/wiki/pull-requests/${prId}/diff`),
      ]);
      setPr(prData.pullRequest || null);
      setDiff(diffData.diff || null);
    } catch (error) {
      console.error('Load wiki PR detail failed:', error);
      setPr(null);
      setDiff(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [prId]);

  const postComment = async () => {
    if (!pr || !comment.trim()) return;
    try {
      await apiPost(`/api/wiki/pull-requests/${pr.id}/comments`, { content: comment.trim() });
      setComment('');
      await load();
    } catch (error) {
      console.error('Post wiki PR comment failed:', error);
      alert('评论失败');
    }
  };

  const mergePr = async () => {
    if (!pr) return;
    try {
      await apiPost(`/api/wiki/pull-requests/${pr.id}/merge`);
      await load();
    } catch (error: any) {
      const message = error?.message || '合并失败';
      alert(message);
      await load();
    }
  };

  const rejectPr = async () => {
    if (!pr) return;
    const note = window.prompt('驳回原因（可选）', '') || '';
    try {
      await apiPost(`/api/wiki/pull-requests/${pr.id}/reject`, { note });
      await load();
    } catch (error) {
      console.error('Reject wiki PR failed:', error);
      alert('驳回失败');
    }
  };

  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-12 text-gray-500">加载中...</div>;
  }
  if (!pr) {
    return <div className="max-w-6xl mx-auto px-4 py-12 text-gray-500">PR 不存在</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Link to="/wiki/pull-requests" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-olive">
          <ArrowLeft size={16} /> 返回 PR 列表
        </Link>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-bold text-brand-olive">{pr.title}</h1>
            <div className="text-sm text-gray-500 mt-2">
              页面: {pr.page?.title || pr.pageSlug} · 状态: {prStatusLabel(pr.status)} · 提交者: {pr.createdByName}
            </div>
            {pr.description ? <p className="text-sm text-gray-700 mt-3">{pr.description}</p> : null}
            {pr.conflictData ? (
              <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                检测到冲突，需先由提交者或管理员解决冲突后再合并。
                {pr.branch ? (
                  <Link to={`/wiki/branches/${pr.branch.id}/conflict`} className="ml-2 underline">
                    前往冲突解决
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          {canReview ? (
            <div className="flex gap-2">
              <button onClick={() => void rejectPr()} className="px-4 py-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100">
                驳回
              </button>
              <button onClick={() => void mergePr()} className="px-4 py-2 rounded-full bg-green-50 text-green-700 hover:bg-green-100">
                合并
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white border border-gray-100 rounded-3xl p-6">
          <h2 className="font-bold text-gray-800 mb-3">主分支版本</h2>
          {diff ? (
            <>
              <div className="text-sm text-gray-500 mb-2">{diff.base.title} · {categoryName(diff.base.category)}</div>
              <div className="prose prose-stone max-w-none text-sm">
                <WikiMarkdown content={diff.base.content || ''} />
              </div>
            </>
          ) : null}
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6">
          <h2 className="font-bold text-gray-800 mb-3">分支版本</h2>
          {diff ? (
            <>
              <div className="text-sm text-gray-500 mb-2">{diff.head.title} · {categoryName(diff.head.category)}</div>
              <div className="prose prose-stone max-w-none text-sm">
                <WikiMarkdown content={diff.head.content || ''} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-3xl p-6">
        <h2 className="font-bold text-gray-800 mb-3">讨论</h2>
        <div className="space-y-3 mb-4">
          {(pr.comments || []).map((item) => (
            <div key={item.id} className="p-3 rounded-xl bg-brand-cream/30 border border-brand-cream">
              <div className="text-xs text-gray-500">{item.authorName} · {fmt(item.createdAt)}</div>
              <div className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{item.content}</div>
            </div>
          ))}
          {(pr.comments || []).length === 0 ? <div className="text-gray-500 text-sm">暂无评论</div> : null}
        </div>
        {user ? (
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="写下评论..."
              className="flex-1 px-3 py-2 rounded-xl border border-gray-200"
            />
            <button onClick={() => void postComment()} className="px-4 py-2 rounded-xl bg-brand-olive text-white">
              发送
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const WikiConflictResolver = () => {
  const { branchId } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  const [branch, setBranch] = useState<WikiBranch | null>(null);
  const [latest, setLatest] = useState<WikiRevision | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'biography',
    content: '',
    tags: '',
    eventDate: '',
  });
  const [saving, setSaving] = useState(false);

  const canResolve = Boolean(user && branch && (isAdmin || branch.editorUid === user.uid));

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!branchId) return;
      try {
        const data = await apiGet<{ branch: WikiBranch; latestRevision: WikiRevision | null }>(`/api/wiki/branches/${branchId}`);
        if (!active) return;
        setBranch(data.branch);
        setLatest(data.latestRevision);
        if (data.latestRevision) {
          setFormData({
            title: data.latestRevision.title,
            category: data.latestRevision.category || 'biography',
            content: data.latestRevision.content,
            tags: (data.latestRevision.tags || []).join(', '),
            eventDate: data.latestRevision.eventDate || '',
          });
        }
      } catch (error) {
        console.error('Load conflict resolver failed:', error);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [branchId]);

  const resolveConflict = async () => {
    if (!branch || !canResolve) return;
    setSaving(true);
    try {
      await apiPost(`/api/wiki/branches/${branch.id}/resolve-conflict`, {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        tags: formData.tags.split(',').map((item) => item.trim()).filter(Boolean),
        eventDate: formData.eventDate || null,
      });
      alert('冲突已解决，PR 已更新为可审核状态');
      navigate('/wiki/pull-requests');
    } catch (error) {
      console.error('Resolve wiki conflict failed:', error);
      alert('解决冲突失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-6">
        <Link to="/wiki/branches" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-olive">
          <ArrowLeft size={16} /> 返回分支列表
        </Link>
      </div>

      {!branch ? <div className="text-gray-500">加载中...</div> : null}
      {branch ? (
        <div className="bg-white border border-gray-100 rounded-3xl p-6">
          <h1 className="font-serif text-3xl font-bold text-brand-olive mb-2">解决冲突</h1>
          <p className="text-sm text-gray-500 mb-4">
            分支: {branch.page?.title || branch.pageSlug} · 当前状态: {branchStatusLabel(branch.status)}
          </p>
          {!canResolve ? <p className="text-red-500 text-sm mb-4">仅分支创建者或管理员可以解决冲突。</p> : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
              placeholder="标题"
            />
            <select
              value={formData.category}
              onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
            >
              <option value="biography">人物介绍</option>
              <option value="music">音乐作品</option>
              <option value="album">专辑一览</option>
              <option value="timeline">时间轴</option>
              <option value="event">活动记录</option>
            </select>
            <input
              type="date"
              value={formData.eventDate}
              onChange={(e) => setFormData((prev) => ({ ...prev, eventDate: e.target.value }))}
              className="px-4 py-3 rounded-2xl bg-brand-cream border-none"
            />
          </div>

          <input
            value={formData.tags}
            onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="标签，逗号分隔"
            className="w-full px-4 py-3 rounded-2xl bg-brand-cream border-none mb-4"
          />

          <div className="border border-gray-100 rounded-3xl overflow-hidden mb-4">
            <MdEditor
              style={{ height: '460px' }}
              renderHTML={(text) => mdParser.render(text)}
              value={formData.content}
              onChange={({ text }) => setFormData((prev) => ({ ...prev, content: text }))}
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => void resolveConflict()}
              disabled={!canResolve || saving}
              className="px-4 py-2 rounded-full bg-brand-olive text-white hover:bg-brand-olive/90 disabled:opacity-50"
            >
              {saving ? '提交中...' : '提交冲突解决结果'}
            </button>
          </div>

          {latest ? (
            <div className="mt-4 text-xs text-gray-500">当前分支版本：{fmt(latest.createdAt)} by {latest.editorName}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const WikiTimeline = () => {
  const [events, setEvents] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{ events: WikiPage[] }>('/api/wiki/timeline');
        if (active) setEvents(data.events || []);
      } catch (error) {
        console.error('Fetch wiki timeline failed:', error);
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <Link to="/wiki" className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-olive mb-6">
        <ArrowLeft size={16} /> 返回百科
      </Link>
      <h1 className="font-serif text-4xl font-bold text-brand-olive mb-6 inline-flex items-center gap-2">
        <Calendar size={28} /> 时间轴
      </h1>
      {loading ? <div className="text-gray-500">加载中...</div> : null}
      {!loading && events.length === 0 ? <div className="text-gray-500">暂无时间轴数据</div> : null}
      <div className="space-y-4">
        {events.map((item) => (
          <Link key={item.id} to={`/wiki/${item.slug}`} className="block bg-white border border-gray-100 rounded-2xl p-4 hover:border-brand-olive/30">
            <div className="text-xs text-gray-500">{item.eventDate || '未设日期'} · {categoryName(item.category)}</div>
            <div className="font-bold text-gray-800 mt-1">{item.title}</div>
          </Link>
        ))}
      </div>
    </div>
  );
};

const Wiki = () => {
  return (
    <Routes>
      <Route path="/" element={<WikiList />} />
      <Route path="/new" element={<WikiEditor />} />
      <Route path="/timeline" element={<WikiTimeline />} />
      <Route path="/branches" element={<WikiBranches />} />
      <Route path="/branches/:branchId/conflict" element={<WikiConflictResolver />} />
      <Route path="/pull-requests" element={<WikiPullRequests />} />
      <Route path="/pull-requests/:prId" element={<WikiPullRequestDetail />} />
      <Route path="/:slug" element={<WikiPageView />} />
      <Route path="/:slug/edit" element={<WikiEditor />} />
      <Route path="/:slug/history" element={<WikiHistory />} />
    </Routes>
  );
};

export default Wiki;
