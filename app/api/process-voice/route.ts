import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/app/lib/supabase'

const anthropic = new Anthropic()

export type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: Request) {
  try {
    const { transcript, conversation }: { transcript: string; conversation: ConversationMessage[] } =
      await request.json()

    if (!transcript || transcript.trim().length === 0) {
      return Response.json({ type: 'error', error: 'Geen tekst ontvangen' }, { status: 400 })
    }

    const systemPrompt = `Je bent een slimme taakassistent die gesproken notities verwerkt. Je reageert altijd in het Nederlands, kort en vriendelijk.

BELANGRIJK: De input komt van spraakherkenning en kan fouten bevatten. Denk altijd na of de tekst logisch klinkt als taak. Als iets vreemd, onduidelijk of onlogisch is (zoals "vorm in bad doen", "blauwe kat ophangen", of willekeurige woorden), vraag dan om verduidelijking. Stel eventueel een logischere interpretatie voor.

Je volgt altijd dit gesprekpad:
1. Controleer of de input een logische taak beschrijft. Zo niet → vraag wat de gebruiker bedoelt, geef eventueel een suggestie
2. Bepaal de taaknaam
3. Vraag of er nog inhoud/details toegevoegd moeten worden (bijv. "Wil je nog details toevoegen, of is dit genoeg?")
4. Vraag of het een privé of zakelijke taak is (bijv. "Is dit een privé of zakelijke taak?")
5. Maak de taak aan

Sla stappen over als de gebruiker ze al beantwoord heeft in eerdere berichten.
Als de gebruiker "nee", "niks", "prima", "doe maar", "aanmaken" of iets vergelijkbaars zegt → ga door naar de volgende stap.

Geef ALTIJD een JSON response:

Als je een vraag stelt (ook bij verduidelijking):
{
  "action": "question",
  "question": "jouw vraag of verduidelijkingsverzoek",
  "taskPreview": { "title": "beste gok voor taaknaam", "notes": null }
}

Als je de taak aanmaakt:
{
  "action": "create",
  "title": "taaknaam (max 60 tekens)",
  "notes": "alle relevante details als tekst, of null",
  "category": "privé" of "zakelijk"
}

Reageer ALLEEN met geldige JSON, geen uitleg.`

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

    let parsed: {
      action: string
      question?: string
      taskPreview?: { title: string; notes: string | null }
      title?: string
      notes?: string | null
      category?: string
    }

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
      const category = parsed.category === 'zakelijk' ? 'zakelijk' : 'privé'

      const { data, error } = await supabase
        .from('tasks')
        .insert({ title: parsed.title, notes: parsed.notes ?? null, category })
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
