'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ContactData {
  firstName: string
  lastName: string
  email: string
  message: string
  company?: string
  reason?: string
}

type Mode = 'chat' | 'contact' | 'fallback'

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I can help you learn about Noah Shaw's professional background or assist you in sending him a message. What would you like to know?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('chat')
  const [contactIntentNotified, setContactIntentNotified] = useState(false)
  const [contactData, setContactData] = useState<ContactData>({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
    company: '',
    reason: '',
  })
  const [contactStep, setContactStep] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognitionAPI) {
        recognitionRef.current = new SpeechRecognitionAPI()
        recognitionRef.current.continuous = false
        recognitionRef.current.interimResults = false
        recognitionRef.current.lang = 'en-US'

        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript
          setInput(prev => prev + transcript)
          setIsListening(false)
        }

        recognitionRef.current.onerror = () => {
          setIsListening(false)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      }
    }
  }, [])

  // Notify about contact intent when user provides name and email
  useEffect(() => {
    if (
      mode === 'contact' &&
      !contactIntentNotified &&
      contactData.firstName &&
      contactData.email
    ) {
      // Send notification that contact intent started
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${contactData.firstName} ${contactData.lastName}`.trim(),
          email: contactData.email,
          company: contactData.company,
          conversationId,
          notifyIntentOnly: true,
        }),
      }).catch(console.error)
      setContactIntentNotified(true)
    }
  }, [mode, contactData.firstName, contactData.email, contactData.lastName, contactData.company, contactIntentNotified, conversationId])

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      setError('Voice input is not supported in your browser.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return

    setError(null)
    const newMessages: Message[] = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
          conversationId,
          conversationHistory: messages.slice(-10),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.fallbackToForm) {
          setMode('fallback')
          setMessages([...newMessages, {
            role: 'assistant',
            content: data.error + ' You can use the form below to send a message directly.',
          }])
        } else {
          setError(data.error || 'Something went wrong. Please try again.')
        }
        return
      }

      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
      if (data.conversationId) {
        setConversationId(data.conversationId)
      }

      // Check if this is a contact intent
      if (data.intent === 'CONTACT_INTENT' && mode === 'chat') {
        setMode('contact')
        setContactStep(0)
      }

      setMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      setError('Failed to connect. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contactData.firstName || !contactData.lastName || !contactData.email || !contactData.message) {
      setError('Please fill in all required fields.')
      return
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(contactData.email)) {
      setError('Please enter a valid email address.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${contactData.firstName} ${contactData.lastName}`,
          email: contactData.email,
          company: contactData.company,
          reason: contactData.reason,
          message: contactData.message,
          conversationId,
        }),
      })

      if (response.ok) {
        setMessages([
          ...messages,
          { role: 'user', content: `[Sent a message to Noah]` },
          { role: 'assistant', content: "Your message has been sent successfully! Noah will get back to you soon." },
        ])
        setMode('chat')
        setContactData({ firstName: '', lastName: '', email: '', message: '', company: '', reason: '' })
        setContactStep(0)
      } else {
        setError('Failed to send message. Please try again.')
      }
    } catch (err) {
      setError('Failed to send message. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="contact" className="py-20 px-6 bg-slate/5">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal mb-4">
          Contact
        </h2>
        <p className="text-slate mb-8">
          Ask about Noah's experience or send him a message.
        </p>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Chat messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-teal text-white rounded-tr-sm'
                      : 'bg-slate/10 text-charcoal rounded-tl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error message */}
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Input area - Chat mode */}
          {mode === 'chat' && (
            <form onSubmit={handleSubmit} className="p-4 border-t border-slate/20">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about Noah or say you want to connect..."
                  className="flex-1 px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  className={`px-4 py-3 rounded-lg transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white'
                      : 'bg-slate/10 text-charcoal hover:bg-slate/20'
                  }`}
                  title="Voice input"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-6 py-3 bg-teal text-white rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </form>
          )}

          {/* Contact form mode */}
          {(mode === 'contact' || mode === 'fallback') && (
            <form onSubmit={handleContactSubmit} className="p-4 border-t border-slate/20 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={contactData.firstName}
                  onChange={(e) => setContactData({ ...contactData, firstName: e.target.value })}
                  placeholder="First name *"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  required
                />
                <input
                  type="text"
                  value={contactData.lastName}
                  onChange={(e) => setContactData({ ...contactData, lastName: e.target.value })}
                  placeholder="Last name *"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  required
                />
              </div>
              <input
                type="email"
                value={contactData.email}
                onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                placeholder="Email *"
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={contactData.company}
                  onChange={(e) => setContactData({ ...contactData, company: e.target.value })}
                  placeholder="Company (optional)"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <input
                  type="text"
                  value={contactData.reason}
                  onChange={(e) => setContactData({ ...contactData, reason: e.target.value })}
                  placeholder="Reason (optional)"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>
              <textarea
                value={contactData.message}
                onChange={(e) => setContactData({ ...contactData, message: e.target.value })}
                placeholder="Your message *"
                rows={4}
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
                required
              />
              <div className="flex gap-2">
                {mode === 'contact' && (
                  <button
                    type="button"
                    onClick={() => setMode('chat')}
                    className="px-6 py-3 bg-slate/10 text-charcoal rounded-lg hover:bg-slate/20 transition-colors"
                  >
                    Back to Chat
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-6 py-3 bg-teal text-white rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Legal disclosures */}
        <p className="mt-4 text-xs text-slate/70 leading-relaxed">
          Responses are AI-assisted. Do not submit sensitive information. Conversations may be logged and retained up to 5 years. By sending a message, you consent to Noah receiving your contact information.
        </p>
      </div>
    </section>
  )
}

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}
