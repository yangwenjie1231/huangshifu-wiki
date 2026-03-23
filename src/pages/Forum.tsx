import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, orderBy, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Heart, Share2, Plus, ChevronRight, Search, Tag, Clock, User as UserIcon, ArrowLeft, Save, X, Send } from 'lucide-react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import MdEditor from 'react-markdown-editor-lite';
import MarkdownIt from 'markdown-it';
import 'react-markdown-editor-lite/lib/index.css';
import { uploadImageToCDNs, getImageUrl } from '../services/imageService';

const mdParser = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true
});

// --- Post List Component ---
const PostList = () => {
  const [searchParams] = useSearchParams();
  const section = searchParams.get('section') || 'all';
  const [posts, setPosts] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchSections = async () => {
      const snapshot = await getDocs(query(collection(db, 'sections'), orderBy('order', 'asc')));
      setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSections();
  }, []);

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    let q = query(postsRef, orderBy('updatedAt', 'desc'));
    if (section !== 'all') {
      q = query(postsRef, where('section', '==', section), orderBy('updatedAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching posts:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [section]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-serif font-bold text-gray-900 mb-2">社区论坛</h1>
          <p className="text-gray-500 italic">诗扶社区 · 与同好分享你的热爱</p>
        </div>
        {user && (
          <Link to="/forum/new" className="px-6 py-3 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all flex items-center gap-2 shadow-md">
            <Plus size={18} /> 发布帖子
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-12">
        <Link
          to="/forum?section=all"
          className={clsx(
            "px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize",
            section === 'all' 
              ? "bg-brand-primary text-gray-900 border-brand-primary" 
              : "bg-white text-gray-500 border-gray-200 hover:border-brand-primary hover:text-brand-primary"
          )}
        >
          全部板块
        </Link>
        {sections.map((sec) => (
          <Link
            key={sec.id}
            to={`/forum?section=${sec.id}`}
            className={clsx(
              "px-6 py-2 rounded-full text-sm font-medium transition-all border capitalize",
              section === sec.id 
                ? "bg-brand-primary text-gray-900 border-brand-primary" 
                : "bg-white text-gray-500 border-gray-200 hover:border-brand-primary hover:text-brand-primary"
            )}
          >
            {sec.name}
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map(i => (
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
                  {sections.find(s => s.id === post.section)?.name || post.section}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-400 text-xs flex items-center gap-1"><Clock size={12} /> {post.updatedAt?.toDate ? format(post.updatedAt.toDate(), 'yyyy-MM-dd') : '刚刚'}</span>
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

// --- Post Detail Component ---
const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSections = async () => {
      const snapshot = await getDocs(query(collection(db, 'sections')));
      setSections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchSections();
  }, []);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const docRef = doc(db, 'posts', postId!);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setPost({ id: docSnap.id, ...docSnap.data() });
        }
      } catch (e) {
        console.error("Error fetching post:", e);
      }
    };

    const commentsRef = collection(db, 'posts', postId!, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    fetchPost();
    return () => unsubscribe();
  }, [postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;

    try {
      const commentsRef = collection(db, 'posts', postId!, 'comments');
      await addDoc(commentsRef, {
        id: crypto.randomUUID(),
        postId,
        authorUid: user.uid,
        authorName: profile?.displayName || user.displayName || '匿名用户',
        authorPhoto: profile?.photoURL || user.photoURL || 'https://picsum.photos/seed/user/100/100',
        content: newComment,
        parentId: replyTo?.id || null,
        createdAt: serverTimestamp()
      });
      
      // Update comment count
      const postRef = doc(db, 'posts', postId!);
      await updateDoc(postRef, {
        commentsCount: (post.commentsCount || 0) + 1
      });
      
      setNewComment('');
      setReplyTo(null);
    } catch (e) {
      console.error("Error adding comment:", e);
    }
  };

  if (loading) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">加载中...</div>;
  if (!post) return <div className="max-w-4xl mx-auto px-4 py-20 text-center italic text-gray-400">帖子未找到</div>;

  const rootComments = comments.filter(c => !c.parentId);
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-primary mb-8 transition-colors">
        <ArrowLeft size={18} /> 返回
      </button>

      <article className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm mb-8">
        <header className="mb-8 border-b border-gray-100 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-brand-primary/10 text-brand-primary text-xs font-bold uppercase tracking-widest rounded-full">
              {sections.find(s => s.id === post.section)?.name || post.section}
            </span>
            <span className="text-gray-400 text-sm flex items-center gap-1"><Clock size={14} /> {post.createdAt?.toDate ? format(post.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '刚刚'}</span>
          </div>
          <h1 className="text-4xl font-serif font-bold text-gray-900 mb-6">{post.title}</h1>
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
          <button className="flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors">
            <Heart size={20} /> {post.likesCount || 0}
          </button>
          <button className="flex items-center gap-2 text-gray-400 hover:text-brand-primary transition-colors">
            <Share2 size={20} /> 分享
          </button>
        </div>
      </article>

      {/* Comments Section */}
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
                onChange={e => setNewComment(e.target.value)}
                placeholder={replyTo ? `回复 @${replyTo.authorName}...` : "发表你的看法..."}
                rows={3}
                className="w-full px-6 py-4 bg-brand-cream rounded-3xl border-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
              />
              <button 
                type="submit"
                className="absolute bottom-4 right-4 p-3 bg-brand-primary text-gray-900 rounded-full hover:scale-105 transition-all shadow-md"
              >
                <Send size={18} />
              </button>
            </div>
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
                  <img src={comment.authorPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-gray-700">{comment.authorName || '匿名用户'}</span>
                    <span className="text-[10px] text-gray-400">{comment.createdAt?.toDate ? format(comment.createdAt.toDate(), 'MM-dd HH:mm') : '刚刚'}</span>
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-2">{comment.content}</p>
                  <button 
                    onClick={() => { setReplyTo(comment); window.scrollTo({ top: document.querySelector('form')?.offsetTop ? document.querySelector('form')!.offsetTop - 200 : 0, behavior: 'smooth' }); }}
                    className="text-[10px] font-bold text-brand-primary hover:underline"
                  >
                    回复
                  </button>
                </div>
              </div>

              {/* Nested Replies */}
              {getReplies(comment.id).length > 0 && (
                <div className="ml-14 space-y-4 border-l-2 border-brand-primary/20 pl-6">
                  {getReplies(comment.id).map(reply => (
                    <div key={reply.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden">
                        <img src={reply.authorPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-700">{reply.authorName || '匿名用户'}</span>
                          <span className="text-[10px] text-gray-400">{reply.createdAt?.toDate ? format(reply.createdAt.toDate(), 'MM-dd HH:mm') : '刚刚'}</span>
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

// --- Post Editor Component ---
const PostEditor = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sections, setSections] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    section: '',
    content: '',
    tags: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSections = async () => {
      const snapshot = await getDocs(query(collection(db, 'sections'), orderBy('order', 'asc')));
      const fetchedSections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSections(fetchedSections);
      if (fetchedSections.length > 0) {
        setFormData(prev => ({ ...prev, section: fetchedSections[0].id }));
      }
    };
    fetchSections();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const postsRef = collection(db, 'posts');
      const newPost = {
        title: formData.title,
        section: formData.section,
        content: formData.content,
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        authorUid: user.uid,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const docRef = await addDoc(postsRef, newPost);
      navigate(`/forum/${docRef.id}`);
    } catch (e) {
      console.error("Error creating post:", e);
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-[40px] p-8 sm:p-12 border border-gray-100 shadow-sm">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-serif font-bold text-gray-900">发布新帖子</h1>
          <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-red-500">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">标题</label>
            <input 
              type="text" 
              required
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              placeholder="输入一个吸引人的标题..."
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-primary/20 font-serif text-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">板块</label>
            <select 
              value={formData.section}
              onChange={e => setFormData({...formData, section: e.target.value})}
              className="w-full px-6 py-4 bg-brand-cream rounded-2xl border-none focus:ring-2 focus:ring-brand-primary/20 font-serif text-xl appearance-none"
            >
              {sections.map(sec => (
                <option key={sec.id} value={sec.id}>{sec.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">标签 (逗号分隔)</label>
            <input 
              type="text" 
              value={formData.tags}
              onChange={e => setFormData({...formData, tags: e.target.value})}
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
                onChange={({ text }) => setFormData({...formData, content: text})}
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
                    html: false
                  },
                  canView: {
                    menu: true,
                    md: true,
                    html: true,
                    fullScreen: true,
                    hideMenu: false
                  }
                }}
              />
            </div>
          </div>

          <div className="pt-8 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="px-12 py-4 bg-brand-primary text-gray-900 rounded-full font-bold hover:scale-105 transition-all shadow-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={20} /> {loading ? '发布中...' : '立即发布'}
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
      <Route path="/:postId" element={<PostDetail />} />
    </Routes>
  );
};

export default Forum;
