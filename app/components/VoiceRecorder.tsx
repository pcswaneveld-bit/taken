'use client'

import { useState, useRef, useCallback } from 'react'

interface VoiceRecorderProps {
  onTaskCreated: () => void
}

type Status = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export default function VoiceRecorder({ onTaskCreated }: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [liveText, setLiveText] = useState('')
  const [error, setError] = useState('')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const transcriptRef = useRef('')

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    silenceTimerRef.current = setTimeout(() => {
      stopAndProcess()
    }, 5000)
  }, [])

  const stopAndProcess = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }

    const transcript = transcriptRef.current.trim()
    if (!transcript) {
      setStatus('idle')
      setLiveText('')
      return
    }

    setStatus('processing')

    try {
      const res = await fetch('/api/process-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Onbekende fout')
      }

      setStatus('done')
      setLiveText('')
      transcriptRef.current = ''
      onTaskCreated()

      setTimeout(() => setStatus('idle'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er is iets fout gegaan')
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setError('') }, 4000)
    }
  }, [onTaskCreated])

  const startRecording = useCallback(() => {
    setError('')
    setLiveText('')
    transcriptRef.current = ''

    const SpeechRecognition =
      window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition: typeof window.SpeechRecognition }).webkitSpeechRecognition

    if (!SpeechRecognition) {
      setError('Spraakherkenning wordt niet ondersteund in deze browser. Gebruik Chrome of Safari.')
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setError('') }, 5000)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'nl-NL'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => {
      setStatus('recording')
      resetSilenceTimer()
    }

    recognition.onresult = (event) => {
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

      if (final) {
        transcriptRef.current += final + ' '
      }
      setLiveText(transcriptRef.current + interim)
      resetSilenceTimer()
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return
      setError(`Fout: ${event.error}`)
      setStatus('error')
      setTimeout(() => { setStatus('idle'); setError('') }, 4000)
    }

    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null
      }
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [resetSilenceTimer])

  const handleStop = useCallback(() => {
    stopAndProcess()
  }, [stopAndProcess])

  const isRecording = status === 'recording'
  const isProcessing = status === 'processing'

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? handleStop : startRecording}
        disabled={isProcessing}
        className={`
          relative flex items-center justify-center w-24 h-24 rounded-full text-white text-4xl
          transition-all duration-200 shadow-lg
          ${isRecording
            ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
            : isProcessing
              ? 'bg-zinc-400 cursor-not-allowed'
              : status === 'done'
                ? 'bg-green-500'
                : 'bg-blue-500 hover:bg-blue-600 hover:scale-105'
          }
        `}
      >
        {isProcessing ? '⏳' : isRecording ? '⏹' : status === 'done' ? '✓' : '🎤'}
      </button>

      <div className="text-sm text-zinc-500 text-center">
        {status === 'idle' && 'Druk om in te spreken'}
        {status === 'recording' && 'Aan het luisteren... (stopt na 5 sec stilte)'}
        {status === 'processing' && 'Taak wordt aangemaakt...'}
        {status === 'done' && 'Taak aangemaakt!'}
        {status === 'error' && <span className="text-red-500">{error}</span>}
      </div>

      {liveText && (
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 min-h-12">
          {liveText}
        </div>
      )}
    </div>
  )
}
