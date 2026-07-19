import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { CreateArticleModal } from './CreateArticleModal'
import { KnowledgeBaseTable, type KbArticle } from './KnowledgeBaseTable'

export default async function KnowledgeBasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Real columns only. The page previously selected slug/body/category — none of
  // which exist on kb_articles (body is `content`, category is a `category_id`
  // FK) — so the whole select errored and the page always rendered empty.
  const { data: articlesData } = await supabaseAdmin
    .from('kb_articles')
    .select('id, category_id, title, content, tags, published, view_count, created_at, kb_categories(name)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  type ArticleWithCat = {
    id: string; title: string; content: string; published: boolean
    view_count: number; created_at: string
    kb_categories: { name: string } | { name: string }[] | null
  }

  const articles: KbArticle[] = ((articlesData || []) as ArticleWithCat[]).map((a) => {
    const cat = Array.isArray(a.kb_categories) ? a.kb_categories[0] : a.kb_categories
    return {
      id: a.id,
      title: a.title,
      content: a.content ?? '',
      category: cat?.name ?? 'General',
      published: a.published,
      view_count: a.view_count ?? 0,
      created_at: a.created_at,
    }
  })

  const publishedCount = articles.filter((a) => a.published).length
  const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0)

  return (
    <div>
      <TopBar
        title="Knowledge Base"
        subtitle={`${articles.length} articles · ${publishedCount} published`}
        actions={<CreateArticleModal />}
      />
      <div className="p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total Articles</p>
            <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{articles.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Published</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{publishedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[var(--text-muted)]">Total Views</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{totalViews.toLocaleString()}</p>
          </Card>
        </div>

        <KnowledgeBaseTable rows={articles} />

      </div>
    </div>
  )
}
