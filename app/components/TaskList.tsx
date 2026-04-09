'use client'

import { useState } from 'react'
import { supabase } from '@/app/lib/supabase'

interface Task {
  id: string
  title: string
  notes: string | null
  completed: boolean
  category: 'privé' | 'zakelijk'
  created_at: string
}

interface TaskListProps {
  tasks: Task[]
  onRefresh: () => void
}

export default function TaskList({ tasks, onRefresh }: TaskListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<'alle' | 'privé' | 'zakelijk'>('alle')

  async function toggleComplete(task: Task) {
    await supabase.from('tasks').update({ completed: !task.completed }).eq('id', task.id)
    onRefresh()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    onRefresh()
  }

  const filtered = tasks.filter((t) => activeCategory === 'alle' || t.category === activeCategory)
  const open = filtered.filter((t) => !t.completed)
  const done = filtered.filter((t) => t.completed)

  const countPrivé = tasks.filter((t) => !t.completed && t.category === 'privé').length
  const countZakelijk = tasks.filter((t) => !t.completed && t.category === 'zakelijk').length

  if (tasks.length === 0) {
    return (
      <p className="text-center text-zinc-400 text-sm py-8">
        Nog geen taken. Spreek iets in!
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-2">
        {(['alle', 'privé', 'zakelijk'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              activeCategory === cat
                ? cat === 'zakelijk'
                  ? 'bg-blue-500 text-white'
                  : cat === 'privé'
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-800 text-white'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {cat}
            {cat === 'privé' && countPrivé > 0 && (
              <span className="ml-1 opacity-75">({countPrivé})</span>
            )}
            {cat === 'zakelijk' && countZakelijk > 0 && (
              <span className="ml-1 opacity-75">({countZakelijk})</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {open.length === 0 && done.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-4">Geen taken in deze categorie.</p>
        )}

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
            <p className="text-xs text-zinc-400 mt-2 mb-1">Afgerond</p>
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
  const categoryColor = task.category === 'zakelijk'
    ? 'bg-blue-100 text-blue-600'
    : 'bg-purple-100 text-purple-600'

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

        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor}`}>
          {task.category}
        </span>

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
