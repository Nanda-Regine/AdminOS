import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { CreateArticleModal } from './CreateArticleModal'

type KbArticle = {
  id: string
  tenant_id: string
  title: string
  slug: string
  body: string
  category: string
  published: boolean
  view_count: number
  created_at: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function categoryLabel(cat: string): string {
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-gray-100 text-gray-700',
  policy: 'bg-blue-100 text-blue-700',
  hr: 'bg-violet-100 text-violet-700',
  finance: 'bg-emerald-100 text-emerald-700',
  operations: 'bg-orange-100 text-orange-700',
  compliance: 'bg-red-100 text-red-700',
  product: 'bg-cyan-100 text-cyan-700',
}

function categoryClass(cat: string): string {
  return CATEGORY_COLORS[cat.toLowerCase()] ?? 'bg-gray-100 text-gray-700'
}

export default async function KnowledgeBasePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  // Also fetch the tenant slug for public URL construction
  const [articlesResult, tenantResult] = await Promise.all([
    supabaseAdmin
      .from('kb_articles')
      .select('id, tenant_id, title, slug, body, category, published, view_count, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('tenants')
      .select('slug')
      .eq('id', tenantId)
      .maybeSingle(),
  ])

  const articles = (articlesResult.data || []) as KbArticle[]
  const tenantSlug = (tenantResult.data as { slug?: string } | null)?.slug ?? tenantId

  // Group by category
  const grouped = articles.reduce((acc: Record<string, KbArticle[]>, article) => {
    const cat = article.category || 'general'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(article)
    return acc
  }, {})

  const sortedCategories = Object.keys(grouped).sort()

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
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <p className="text-xs text-gray-500">Total Articles</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{articles.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Published</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500">Total Views</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{totalViews.toLocaleString()}</p>
          </Card>
        </div>

        {articles.length === 0 ? (
          <Card>
            <div className="text-center py-14 text-gray-400">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-sm">No knowledge base articles yet. Create your first article to help customers self-serve.</p>
            </div>
          </Card>
        ) : (
          sortedCategories.map((category) => (
            <Card key={category}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${categoryClass(category)}`}>
                  {categoryLabel(category)}
                </span>
                <span className="text-xs text-gray-400">{grouped[category].length} articles</span>
              </div>

              <div className="divide-y divide-gray-50">
                {grouped[category].map((article) => (
                  <div key={article.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {article.title}
                          </p>
                          <Badge variant={article.published ? 'green' : 'gray'}>
                            {article.published ? 'Published' : 'Draft'}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(article.created_at)}
                          {article.published && (
                            <> · <a
                              href={`/kb/${tenantSlug}/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:underline"
                            >
                              /kb/{tenantSlug}/{article.slug}
                            </a></>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                        <span>👁</span>
                        <span>{(article.view_count || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}

      </div>
    </div>
  )
}
