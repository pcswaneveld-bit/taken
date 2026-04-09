'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceRecorderProps {
  onTaskCreated: () => void
}

type Status = 'idle' | 'recording' | 'speaking' | 'processing' | 'done' | 'error'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any

type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

type TaskPreview = {
  title: string
  notes: string | null
}

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'nl-NL'
    utterance.rate = 1.05
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

export default function VoiceRecorder({ onTaskCreated }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [liveText, setLiveText] = useState('')
  const [interimText, setInterimText] = useState('')
  const [question, setQuestion] = useState('')
  const [taskPreview, setTaskPreview] = useState<TaskPreview | null>(null)
  const [error, setError] = useState('')

  const recognitionRef = useRef<AnyRecognition>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptRef = useRef('')
  const conversationRef = useRef<ConversationMessage[]>([])

  const resetSilenceTimer = useCallback((onSilence: () => void) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(onSilence, 5000)
  }, [])

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }, [])

  const startRecognition = useCallback((onFinal: (transcript: string) => void) => {
    const w = window as unknown as Record<string, unknown>
    const SpeechRecognitionAPI =
      (w['SpeechRecognition'] as new () => AnyRecognition) ||
      (w['webkitSpeechRecognition'] as new () => AnyRecognition)

    if (!SpeechRecognitionAPI) {
      setError('Spraakherkenning wordt niet ondersteund. Gebruik Chrome of Safari.')
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setError('') }, 5000)
      return
    }

    transcriptRef.current = ''
    setLiveText('')
    setInterimText('')

    const recognition = new SpeechRecognitionAPI()
    recognition.lang = 'nl-NL'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event: { resultIndex: number; results: { isFinal: boolean; [n: number]: { transcript: string } }[] }) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript
        } else {
          interim += result[0].transcript
        }
      }
      if (final) transcriptRef.current += final + ' '
      setLiveText(transcriptRef.current)
      setInterimText(interim)
      resetSilenceTimer(() => {
        stopRecognition()
        onFinal(transcriptRef.current.trim())
      })
    }

    recognition.onerror = (event: { error: string }) => {
      if (event.error === 'no-speech') return
      setError(`Fout: ${event.error}`)
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setError('') }, 4000)
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [resetSilenceTimer, stopRecognition])

  const sendToApi = useCallback(async (transcript: string) => {
    setStatus('processing')
    setLiveText('')
    setInterimText('')

    try {
      const res = await fetch('/api/process-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, conversation: conversationRef.current }),
      })

      const data = await res.json()

      if (data.type === 'question') {
        conversationRef.current = [
          ...conversationRef.current,
          { role: 'user', content: transcript },
          { role: 'assistant', content: data.assistantMessage },
        ]
        setTaskPreview(data.taskPreview)
        setQuestion(data.question)
        setStatus('speaking')
        await speak(data.question)
        setStatus('recording')
        startRecognition(sendToApi)

      } else if (data.type === 'created') {
        const title = data.task?.title || 'Taak'
        setQuestion('')
        setTaskPreview(null)
        conversationRef.current = []
        setStatus('speaking')
        await speak(`Taak aangemaakt: ${title}`)
        setStatus('done')
        onTaskCreated()
        setTimeout(() => setStatus('idle'), 2000)

      } else {
        throw new Error(data.error || 'Onbekende fout')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is iets fout gegaan')
      setStatus('error')
      conversationRef.current = []
      setTimeout(() => { setStatus('idle'); setError(''); setQuestion(''); setTaskPreview(null) }, 4000)
    }
  }, [startRecognition, onTaskCreated])

  const handleStart = useCallback(() => {
    setError('')
    setQuestion('')
    setTaskPreview(null)
    conversationRef.current = []
    setStatus('recording')
    startRecognition(sendToApi)
  }, [startRecognition, sendToApi])

  const handleStop = useCallback(() => {
    stopRecognition()
    if (transcriptRef.current.trim()) {
      sendToApi(transcriptRef.current.trim())
    } else {
      setStatus('idle')
    }
  }, [stopRecognition, sendToApi])

  const isRecording = status === 'recording'
  const isProcessing = status === 'processing'
  const isSpeaking = status === 'speaking'
  const isBusy = isProcessing || isSpeaking

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <button
        onClick={isRecording ? handleStop : isBusy ? undefined : handleStart}
        disabled={isBusy}
        className={`
          relative flex items-center justify-center w-24 h-24 rounded-full text-white text-4xl
          transition-all duration-200 shadow-lg
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
            : isBusy
              ? 'bg-zinc-400 cursor-not-allowed'
              : status === 'done'
                ? 'bg-green-500'
                : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }
        `}
      >
        {isProcessing ? '⏳' : isSpeaking ? '🔊' : isRecording ? '⏹' : status === 'done' ? '✓' : '🎤'}
      </button>

      <div className="text-sm text-zinc-500 text-center">
        {status === 'idle' && 'Druk om in te spreken'}
        {status === 'recording' && !question && 'Aan het luisteren... (stopt na 5 sec stilte)'}
        {status === 'recording' && question && 'Jouw antwoord...'}
        {status === 'processing' && 'Verwerken...'}
        {status === 'speaking' && 'App spreekt...'}
        {status === 'done' && 'Taak aangemaakt!'}
        {status === 'error' && <span className="text-red-500">{error}</span>}
      </div>

      {question && (
        <div className="w-full max-w-md rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {question}
        </div>
      )}

      {taskPreview && (
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          <span className="font-medium text-zinc-800">{taskPreview.title}</span>
          {taskPreview.notes && <p className="mt-1">{taskPreview.notes}</p>}
        </div>
      )}

      {(liveText || interimText) && (
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 min-h-12">
          {liveText}
          {interimText && <span className="text-zinc-400">{interimText}</span>}
        </div>
      )}
    </div>
  )
}
