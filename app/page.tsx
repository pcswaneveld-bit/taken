'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/app/lib/supabase'
import VoiceRecorder from '@/app/components/VoiceRecorder'
import TaskList from '@/app/components/TaskList'

interface Task {
  id: string
  title: string
  notes: string | null
  completed: boolean
  created_at: string
}

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])

  const loadTasks = useCallback(async () => {
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setTasks(data)
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  return (
    <main className="min-h-screen bg-zinc-50 flex flex-col items-center px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Taken</h1>
          <p className="text-sm text-zinc-500 mt-1">Spreek een taak in</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col items-center gap-4 shadow-sm">
          <VoiceRecorder onTaskCreated={loadTasks} />
        </div>

        <TaskList tasks={tasks} onRefresh={loadTasks} />
      </div>
    </main>
  )
}
