import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/app/lib/supabase'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  try {
    const { transcript } = await request.json()

    if (!transcript || transcript.trim().length === 0) {
      return Response.json({ error: 'Geen tekst ontvangen' }, { status: 400 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `Je krijgt een gesproken notitie van een gebruiker. Maak hier een taak van.

Gesproken notitie: "${transcript}"

Geef een JSON response met:
- title: korte, duidelijke taaknaam (max 60 tekens)
- notes: extra context of details die nuttig zijn voor de taak (null als er niets extra is)

Reageer ALLEEN met geldige JSON, geen uitleg.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return Response.json({ error: 'Onverwacht antwoord van Claude' }, { status: 500 })
    }

    let parsed: { title: string; notes: string | null }
    try {
      const clean = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsed = JSON.parse(clean)
    } catch {
      return Response.json({ error: `Kon Claude response niet verwerken: ${content.text}` }, { status: 500 })
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({ title: parsed.title, notes: parsed.notes })
      .select()
      .single()

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ task: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onbekende serverfout'
    return Response.json({ error: message }, { status: 500 })
  }
}
