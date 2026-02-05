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

type Mode = 'chat' | 'fallback'

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi there! I'm Noah's assistant. I can tell you about his professional background, or help you get a message to him. What can I help you with today?",
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('chat')
  const [isListening, setIsListening] = useState(false)
  const [isSendingContact, setIsSendingContact] = useState(false)
  // Fallback form data (only used when chat fails)
  const [fallbackFormData, setFallbackFormData] = useState<ContactData>({
    firstName: '',
    lastName: '',
    email: '',
    message: '',
    company: '',
    reason: '',
  })
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)

  // Scroll to bottom when messages change - contained within chat container only
  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
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
          if (event.results && event.results.length > 0 && event.results[0].length > 0) {
            const transcript = event.results[0][0].transcript
            setInput(prev => prev + transcript)
          }
          setIsListening(false)
        }

        recognitionRef.current.onerror = (event: any) => {
          setIsListening(false)
          setError('Voice recognition error. Please try typing instead.')
          console.error('Speech recognition error:', event.error)
        }

        recognitionRef.current.onend = () => {
          setIsListening(false)
        }
      }
    }
  }, [])

  /**
   * Parse CONTACT_READY JSON from assistant response
   */
  const parseContactReady = (response: string): ContactData | null => {
    const match = response.match(/```CONTACT_READY\s*\n?([\s\S]*?)\n?```/)
    if (!match) return null

    try {
      const data = JSON.parse(match[1])
      if (data.firstName && data.lastName && data.email && data.message) {
        return {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          message: data.message,
          company: data.company || '',
          reason: data.reason || '',
        }
      }
    } catch (e) {
      console.error('Failed to parse CONTACT_READY:', e)
    }
    return null
  }

  /**
   * Remove CONTACT_READY JSON block from displayed message
   */
  const cleanResponseForDisplay = (response: string): string => {
    return response.replace(/```CONTACT_READY\s*\n?[\s\S]*?\n?```/g, '').trim()
  }

  /**
   * Send contact data to the API
   */
  const sendContactData = async (contactData: ContactData): Promise<boolean> => {
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
      return response.ok
    } catch (e) {
      console.error('Failed to send contact:', e)
      return false
    }
  }

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

      // Check if response contains CONTACT_READY data
      const contactData = parseContactReady(data.response)
      const displayResponse = cleanResponseForDisplay(data.response)

      if (contactData) {
        // Show the confirmation message first
        setMessages([...newMessages, { role: 'assistant', content: displayResponse }])

        // Send the contact data automatically
        setIsSendingContact(true)
        const success = await sendContactData(contactData)
        setIsSendingContact(false)

        if (success) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: "I've sent your message to Noah. He'll get back to you soon!",
          }])
        } else {
          setError('Failed to send your message. Please try again.')
          setMode('fallback')
        }
      } else {
        setMessages([...newMessages, { role: 'assistant', content: displayResponse || data.response }])
      }
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

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!fallbackFormData.firstName || !fallbackFormData.lastName || !fallbackFormData.email || !fallbackFormData.message) {
      setError('Please fill in all required fields.')
      return
    }

    // Validate email
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(fallbackFormData.email)) {
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
          name: `${fallbackFormData.firstName} ${fallbackFormData.lastName}`,
          email: fallbackFormData.email,
          company: fallbackFormData.company,
          reason: fallbackFormData.reason,
          message: fallbackFormData.message,
          conversationId,
        }),
      })

      if (response.ok) {
        setMessages([
          ...messages,
          { role: 'assistant', content: "Your message has been sent successfully! Noah will get back to you soon." },
        ])
        setMode('chat')
        setFallbackFormData({ firstName: '', lastName: '', email: '', message: '', company: '', reason: '' })
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
          <div ref={chatContainerRef} className="h-96 overflow-y-auto p-4 space-y-4">
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

            {(isLoading || isSendingContact) && (
              <div className="flex justify-start">
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    {isSendingContact && <span className="ml-2 text-sm text-slate">Sending your message...</span>}
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

          {/* Fallback form - only shown when chat service fails */}
          {mode === 'fallback' && (
            <form onSubmit={handleFallbackSubmit} className="p-4 border-t border-slate/20 space-y-4">
              <p className="text-sm text-slate mb-2">Use the form below to send Noah a message directly:</p>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={fallbackFormData.firstName}
                  onChange={(e) => setFallbackFormData({ ...fallbackFormData, firstName: e.target.value })}
                  placeholder="First name *"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  required
                />
                <input
                  type="text"
                  value={fallbackFormData.lastName}
                  onChange={(e) => setFallbackFormData({ ...fallbackFormData, lastName: e.target.value })}
                  placeholder="Last name *"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                  required
                />
              </div>
              <input
                type="email"
                value={fallbackFormData.email}
                onChange={(e) => setFallbackFormData({ ...fallbackFormData, email: e.target.value })}
                placeholder="Email *"
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={fallbackFormData.company}
                  onChange={(e) => setFallbackFormData({ ...fallbackFormData, company: e.target.value })}
                  placeholder="Company (optional)"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
                <input
                  type="text"
                  value={fallbackFormData.reason}
                  onChange={(e) => setFallbackFormData({ ...fallbackFormData, reason: e.target.value })}
                  placeholder="Reason (optional)"
                  className="px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                />
              </div>
              <textarea
                value={fallbackFormData.message}
                onChange={(e) => setFallbackFormData({ ...fallbackFormData, message: e.target.value })}
                placeholder="Your message *"
                rows={4}
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
                required
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-6 py-3 bg-teal text-white rounded-lg hover:bg-teal-dark transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send Message'}
              </button>
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
