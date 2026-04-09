'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

interface Task {
  id: string
  title: string
  notes: string | null
  completed: boolean
  created_at: string
}

interface TaskListProps {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  async function toggleComplete(task: Task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    onRefresh()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    onRefresh()
  }

  if (tasks.length === 0) {
    return (
      <p className="text-center text-zinc-400 text-sm py-8">
        Nog geen taken. Spreek iets in!
      </p>
    )
  }

  const open = tasks.filter((t) => !t.completed)
  const done = tasks.filter((t) => t.completed)

  return (
    <div className="flex flex-col gap-2 w-full">
      {open.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          expanded={expanded === task.id}
          onToggleExpand={() => setExpanded(expanded === task.id ? null : task.id)}
          onToggleComplete={toggleComplete}
          onDelete={deleteTask}
        />
      ))}

      {done.length > 0 && (
        <>
          <p className="text-xs text-zinc-400 mt-4 mb-1">Afgerond</p>
          {done.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              expanded={expanded === task.id}
              onToggleExpand={() => setExpanded(expanded === task.id ? null : task.id)}
              onToggleComplete={toggleComplete}
              onDelete={deleteTask}
            />
          ))}
        </>
      )}
    </div>
  )
}

function TaskItem({
  task,
  expanded,
  onToggleExpand,
  onToggleComplete,
  onDelete,
}: {
  task: Task
  expanded: boolean
  onToggleExpand: () => void
  onToggleComplete: (task: Task) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        task.completed ? 'border-zinc-100 bg-zinc-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggleComplete(task)}
          className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.completed
              ? 'border-green-500 bg-green-500 text-white'
              : 'border-zinc-300 hover:border-blue-400'
          }`}
        >
          {task.completed && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button
          onClick={onToggleExpand}
          className={`flex-1 text-left text-sm font-medium ${
            task.completed ? 'text-zinc-400 line-through' : 'text-zinc-800'
          }`}
        >
          {task.title}
          {task.notes && !expanded && (
            <span className="ml-2 text-xs text-zinc-400 font-normal">(meer)</span>
          )}
        </button>

        <button
          onClick={() => onDelete(task.id)}
          className="flex-shrink-0 text-zinc-300 hover:text-red-400 transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>

      {expanded && task.notes && (
        <p className="mt-2 ml-8 text-sm text-zinc-500">{task.notes}</p>
      )}
    </div>
  )
}
