import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/app/lib/supabase'

const anthropic = new Anthropic()

export type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ApiResponse =
  | { type: 'question'; question: string; taskPreview: { title: string; notes: string | null } }
  | { type: 'created'; task: Record<string, unknown> }
  | { type: 'error'; error: string }

export async function POST(request: Request) {
  try {
    const { transcript, conversation }: { transcript: string; conversation: ConversationMessage[] } =
      await request.json()

    if (!transcript || transcript.trim().length === 0) {
      return Response.json({ type: 'error', error: 'Geen tekst ontvangen' }, { status: 400 })
    }

    const systemPrompt = `Je bent een slimme taakassistent die gesproken notities verwerkt.

Je voert een gesprek met de gebruiker om een taak aan te maken. Je reageert altijd in het Nederlands.

Regels:
- Stel maximaal 1 vervolgvraag per beurt
- Als je genoeg info hebt, maak de taak dan aan (na maximaal 2 vragen)
- Als de gebruiker zegt "aanmaken", "doe maar", "ja", "prima", "oké" of iets vergelijkbaars → maak de taak direct aan
- Als de gebruiker extra info geeft → verwerk die info en maak de taak aan

Geef ALTIJD een JSON response in dit formaat:

Als je een vraag stelt:
{
  "action": "question",
  "question": "jouw vraag hier",
  "taskPreview": { "title": "taaknaam", "notes": "eventuele notities of null" }
}

Als je de taak aanmaakt:
{
  "action": "create",
  "title": "taaknaam (max 60 tekens)",
  "notes": "alle relevante details als één tekst, of null als er niets extra is"
}

Reageer ALLEEN met geldige JSON.`

    const messages: Anthropic.MessageParam[] = [
      ...conversation.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: transcript },
    ]

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages,
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ type: 'error', error: 'Onverwacht antwoord van Claude' }, { status: 500 })
    }

    let parsed: { action: string; question?: string; taskPreview?: { title: string; notes: string | null }; title?: string; notes?: string | null }
    try {
      const clean = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return Response.json({ type: 'error', error: `Kon response niet verwerken: ${content.text}` }, { status: 500 })
    }

    if (parsed.action === 'question') {
      return Response.json({
        type: 'question',
        question: parsed.question,
        taskPreview: parsed.taskPreview,
        assistantMessage: content.text,
      })
    }

    if (parsed.action === 'create') {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ title: parsed.title, notes: parsed.notes ?? null })
        .select()
        .single()

      if (error) {
        return Response.json({ type: 'error', error: error.message }, { status: 500 })
      }

      return Response.json({ type: 'created', task: data, assistantMessage: content.text })
    }

    return Response.json({ type: 'error', error: 'Onbekende actie van Claude' }, { status: 500 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende serverfout'
    return Response.json({ type: 'error', error: message }, { status: 500 })
  }
}
