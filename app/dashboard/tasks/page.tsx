import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'
import { CreateTaskModal, MoveTaskButton } from './TaskActions'

export const dynamic = 'force-dynamic'

const priorityVariant: Record<string, 'red' | 'yellow' | 'blue' | 'gray'> = {
  urgent: 'red',
  high:   'yellow',
  medium: 'blue',
  low:    'gray',
}

interface StaffMember {
  id: string
  full_name: string
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  assigned_to: string | null
  source: string | null
  created_at: string
}

function initials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function TaskColumn({
  title,
  tasks,
  accent,
  staffMap,
}: {
  title: string
  tasks: Task[]
  accent: string
  staffMap: Record<string, string>
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className={`flex items-center justify-between pb-2.5 border-b-2 ${accent}`}>
        <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-widest">{title}</h3>
        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2 min-h-[40px]">
        {tasks.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-8">Empty</p>
        )}
        {tasks.map((task) => {
          const assigneeName = task.assigned_to ? staffMap[task.assigned_to] : null
          const isOverdue = task.due_date && new Date(task.due_date) < new Date()

          return (
            <Card key={task.id} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 leading-snug flex-1">
                  {task.title}
                </p>
                <Badge variant={priorityVariant[task.priority] ?? 'gray'}>
                  {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                </Badge>
              </div>
              <div className="mt-2">
                <MoveTaskButton taskId={task.id} currentStatus={task.status} />
              </div>

              {task.description && (
                <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {assigneeName ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-[10px] font-bold shrink-0">
                        {initials(assigneeName)}
                      </div>
                      <span className="text-xs text-gray-500 truncate max-w-[80px]">
                        {assigneeName.split(' ')[0]}
                      </span>
                    </div>
                  ) : null}
                  {task.source && task.source !== 'manual' && (
                    <span className="text-[10px] text-gray-300 bg-gray-50 px-1.5 py-0.5 rounded">
                      {task.source.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>

                {task.due_date && (
                  <span
                    className={`text-xs font-medium shrink-0 ${
                      isOverdue ? 'text-red-500' : 'text-gray-400'
                    }`}
                  >
                    {isOverdue ? '⚠ ' : ''}
                    {new Date(task.due_date).toLocaleDateString('en-ZA', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [tasksResult, staffResult] = await Promise.all([
    supabaseAdmin
      .from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, source, created_at')
      .eq('tenant_id', tenantId)
      .order('priority')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabaseAdmin
      .from('staff')
      .select('id, full_name')
      .eq('tenant_id', tenantId),
  ])

  const allTasks: Task[] = tasksResult.data || []
  const staffList: StaffMember[] = staffResult.data || []

  // Build a UUID → name lookup so task cards show real names
  const staffMap: Record<string, string> = {}
  for (const s of staffList) staffMap[s.id] = s.full_name

  const todo       = allTasks.filter(t => t.status === 'todo')
  const inProgress = allTasks.filter(t => t.status === 'in_progress')
  const done       = allTasks.filter(t => t.status === 'done')

  const urgentOpen = allTasks.filter(t => t.priority === 'urgent' && t.status !== 'done')
  const overdueOpen = allTasks.filter(
    t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
  )

  return (
    <div>
      <TopBar
        title="Tasks"
        subtitle={`${allTasks.length} total · ${todo.length + inProgress.length} open`}
        actions={<CreateTaskModal staff={staffList} />}
      />
      <div className="p-6 space-y-5">

        {/* Alert banners */}
        {urgentOpen.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm">
            <span className="text-red-500 font-bold text-base leading-none">!</span>
            <span className="font-semibold text-red-700">
              {urgentOpen.length} urgent task{urgentOpen.length !== 1 ? 's' : ''}
            </span>
            <span className="text-red-400">need immediate attention</span>
          </div>
        )}
        {overdueOpen.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-xl text-sm">
            <span className="text-orange-500">⚠</span>
            <span className="font-semibold text-orange-700">
              {overdueOpen.length} overdue task{overdueOpen.length !== 1 ? 's' : ''}
            </span>
            <span className="text-orange-400">past their due date</span>
          </div>
        )}

        {/* Kanban */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TaskColumn title="To Do"      tasks={todo}       accent="border-gray-200"   staffMap={staffMap} />
          <TaskColumn title="In Progress" tasks={inProgress} accent="border-yellow-400" staffMap={staffMap} />
          <TaskColumn title="Done"        tasks={done}       accent="border-emerald-400" staffMap={staffMap} />
        </div>

        {allTasks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <span className="text-2xl">✓</span>
            </div>
            <p className="text-sm font-medium text-gray-500">All clear</p>
            <p className="text-xs mt-1">Tasks created by you or Langa will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
