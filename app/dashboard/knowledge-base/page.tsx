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

        <KnowledgeBaseTable rows={articles} tenantSlug={tenantSlug} />

      </div>
    </div>
  )
}
