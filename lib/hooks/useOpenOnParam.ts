'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * Opens a create modal when the URL carries `?<param>=1`, then strips the param
 * so a refresh or back-nav doesn't re-open it. This is what makes an EmptyState's
 * primary CTA (`<Link href="?new=1">`) actually open the modal that lives in the
 * page header — the two are sibling components with no shared state otherwise.
 *
 *   const [open, setOpen] = useState(false)
 *   useOpenOnParam('new', () => setOpen(true))
 */
export function useOpenOnParam(param: string, open: () => void) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (params.get(param) !== '1') return
    open()
    // Drop the param without a navigation entry so refresh/back won't re-trigger.
    const next = new URLSearchParams(params.toString())
    next.delete(param)
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    // Only re-run when the param value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.get(param)])
}
