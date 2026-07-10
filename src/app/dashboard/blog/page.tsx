"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { generateBlogArticles, BlogArticle } from "@/lib/blog-generator";
import { useAuth } from "@/contexts/AuthContext";
import type { BlogTemplate } from "@/lib/blog-templates";
import {
  Plus, Edit3, Eye, Trash2, CheckCircle2, FileText, Image as ImageIcon,
  Calendar, Send, Loader2, Sparkles,
} from "lucide-react";

interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  isPublished: boolean;
  publishedAt: Date | null;
  views: number;
  createdAt: Date;
}

export default function BlogPage() {
  const { user } = useAuth();
  const toast = useToast();
  const plan = user?.subscription || "free";
  const maxArticles = plan === "free" ? 3 : Infinity; // 3 modèles pour le plan gratuit
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [formData, setFormData] = useState({ title: "", excerpt: "", content: "", coverImage: "" });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTopic, setAiTopic] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch("/api/blog");
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const generateWithAI = async () => {
    if (!aiTopic) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai-blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: aiTopic }),
      });
      const data = await res.json();
      if (data.content) {
        setFormData({ ...formData, title: aiTopic, content: data.content });
        setAiTopic("");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.content) return;
    if (plan === "free" && !editingPost && posts.length >= 3) {
      // Lot 22 : toast au lieu d'alert bloquant, laisse le temps de le lire
      toast.warning(
        "Plan gratuit : 3 articles max. Passez au plan Pro pour des articles illimités."
      );
      setTimeout(() => {
        window.location.href = "/dashboard/settings?tab=abonnement";
      }, 1200);
      return;
    }

    try {
      const method = editingPost ? "PUT" : "POST";
      const res = await fetch(`/api/blog${editingPost ? `/${editingPost.id}` : ""}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        fetchPosts();
        setShowEditor(false);
        setEditingPost(null);
        setFormData({ title: "", excerpt: "", content: "", coverImage: "" });
      }
    } catch (e) { console.error(e); }
  };

  const handlePublish = async (id: string) => {
    await fetch(`/api/blog/${id}/publish`, { method: "PUT" });
    fetchPosts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await fetch(`/api/blog/${id}`, { method: "DELETE" });
    fetchPosts();
  };

  const loadTemplate = (article: BlogArticle) => {
    setFormData({ title: article.title, excerpt: article.excerpt, content: article.content, coverImage: "" });
    setShowEditor(true);
    setEditingPost(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Blog</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Créez du contenu pour améliorer votre référencement</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowEditor(true)}>
            <Plus className="mr-1 h-4 w-4" /> Nouvel article
          </Button>
        </div>
      </div>

      {/* Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Articles pré-rédigés selon votre métier
          </CardTitle>
          <CardDescription>Cliquez sur un article pour le personnaliser et le publier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {generateBlogArticles("plombier").slice(0, plan === "free" ? 3 : 99).map((article, i) => (
              <button
                key={i}
                onClick={() => loadTemplate(article)}
                className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-slate-900 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-white dark:hover:bg-slate-800"
              >
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <FileText className="h-3 w-3" />
                  Article SEO optimisé
                </div>
                <p className="font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{article.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{article.excerpt}</p>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Utiliser cet article →</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Posts list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-700" />
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Aucun article publié</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Commencez par utiliser un article pré-rédigé ou créez le vôtre.</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-900 dark:text-slate-100 truncate">{post.title}</h3>
                    <Badge variant={post.isPublished ? "success" : "warning"}>
                      {post.isPublished ? "Publié" : "Brouillon"}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString("fr-FR") : new Date(post.createdAt).toLocaleDateString("fr-FR")}</span>
                    <span>{post.views} vues</span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setEditingPost(post); setFormData({ title: post.title, excerpt: post.excerpt || "", content: post.content, coverImage: "" }); setShowEditor(true); }}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  {!post.isPublished && (
                    <Button variant="ghost" size="icon" className="text-emerald-600" onClick={() => handlePublish(post.id)}>
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDelete(post.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowEditor(false); setEditingPost(null); }} />
          <div className="relative z-10 w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {editingPost ? "Modifier l'article" : "Nouvel article"}
              </h3>
              <button onClick={() => { setShowEditor(false); setEditingPost(null); }} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            <div className="space-y-4">
              {/* Générateur IA */}
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/50 dark:bg-purple-900/10">
                <p className="text-sm font-medium text-purple-900 dark:text-purple-200 flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4" /> Assistant Rédaction IA
                </p>
                <div className="flex gap-2">
                  <Input placeholder="Ex: Conseils plomberie hiver..." value={aiTopic} onChange={e => setAiTopic(e.target.value)} className="flex-1" />
                  <Button onClick={generateWithAI} loading={isGenerating} variant="outline" size="sm">Générer</Button>
                </div>
                <p className="text-xs text-purple-700 dark:text-purple-300 mt-2">L&apos;IA rédige un article SEO que vous pouvez modifier ensuite.</p>
              </div>

              <Input label="Titre" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Titre de l'article" />
              <Textarea label="Résumé" value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} placeholder="Court résumé pour le SEO..." />
              <Input label="URL de l'image de couverture (optionnel)" value={formData.coverImage} onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })} placeholder="https://..." />
              <Textarea label="Contenu (Markdown)" value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} className="min-h-[300px] font-mono text-sm" placeholder="# Titre\n\nContenu de votre article..." />
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowEditor(false); setEditingPost(null); }}>Annuler</Button>
                <Button onClick={handleSave}>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {editingPost ? "Enregistrer" : "Créer l'article"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
