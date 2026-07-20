'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, FormField, inputCls, inputSty, Btn } from '@/components/ui/modal'
import { useOpenOnParam } from '@/lib/hooks/useOpenOnParam'

export function AddStaffModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    fullName: '',
    jobTitle: '',
    department: '',
    phone: '',
    email: '',
    salary: '',
    leaveBalance: '15',
    employmentType: 'full_time' as 'full_time' | 'part_time' | 'contract' | 'casual',
  })

  const set = (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))

  useOpenOnParam('new', () => setOpen(true))

  const handleClose = useCallback(() => {
    setOpen(false)
    setError(null)
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const body: Record<string, unknown> = {
        fullName: form.fullName,
        jobTitle: form.jobTitle || undefined,
        employmentType: form.employmentType,
      }
      if (form.phone) body.phone = form.phone
      if (form.email) body.email = form.email
      if (form.salary) body.salary = Number(form.salary)

      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      router.refresh()
      setOpen(false)
      setForm({
        fullName: '',
        jobTitle: '',
        department: '',
        phone: '',
        email: '',
        salary: '',
        leaveBalance: '15',
        employmentType: 'full_time',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Staff
      </button>

      <Modal open={open} onClose={handleClose} title="Add Staff Member" size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Row 1: Full name + Role / Job title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Full Name *">
              <input
                required
                type="text"
                value={form.fullName}
                onChange={set('fullName')}
                placeholder="e.g. Thabo Nkosi"
                className={inputCls}
                style={inputSty}
              />
            </FormField>

            <FormField label="Role / Job Title *">
              <input
                required
                type="text"
                value={form.jobTitle}
                onChange={set('jobTitle')}
                placeholder="e.g. Sales Assistant"
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          </div>

          {/* Row 2: Department + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Department">
              <input
                type="text"
                value={form.department}
                onChange={set('department')}
                placeholder="e.g. Operations"
                className={inputCls}
                style={inputSty}
              />
            </FormField>

            <FormField label="Phone">
              <input
                type="text"
                value={form.phone}
                onChange={set('phone')}
                placeholder="+27 ..."
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          </div>

          {/* Row 3: Email + Salary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Email">
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                placeholder="staff@example.com"
                className={inputCls}
                style={inputSty}
              />
            </FormField>

            <FormField label="Salary" hint="Monthly gross in ZAR">
              <input
                type="number"
                min={0}
                value={form.salary}
                onChange={set('salary')}
                placeholder="e.g. 12000"
                className={inputCls}
                style={inputSty}
              />
            </FormField>
          </div>

          {/* Row 4: Leave balance + Employment type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Leave Balance" hint="Annual leave days">
              <input
                type="number"
                min={0}
                value={form.leaveBalance}
                onChange={set('leaveBalance')}
                className={inputCls}
                style={inputSty}
              />
            </FormField>

            <FormField label="Employment Type">
              <select
                value={form.employmentType}
                onChange={set('employmentType')}
                className={inputCls}
                style={inputSty}
              >
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="casual">Casual</option>
              </select>
            </FormField>
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Btn type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Btn>
            <Btn type="submit" loading={loading}>
              Add Staff Member
            </Btn>
          </div>
        </form>
      </Modal>
    </>
  )
}
