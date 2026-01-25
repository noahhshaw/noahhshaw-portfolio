'use client'

import { useState } from 'react'

type Stage = 'initial' | 'name' | 'email' | 'message' | 'sending' | 'success'

interface FormData {
  name: string
  email: string
  message: string
}

export default function ChatContact() {
  const [stage, setStage] = useState<Stage>('initial')
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: '',
  })
  const [currentInput, setCurrentInput] = useState('')
  const [error, setError] = useState('')

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentInput.trim()) {
      setError('Please enter your name')
      return
    }
    setFormData({ ...formData, name: currentInput })
    setCurrentInput('')
    setError('')
    setStage('email')
  }

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentInput.trim()) {
      setError('Please enter your email')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(currentInput)) {
      setError('Please enter a valid email address')
      return
    }
    setFormData({ ...formData, email: currentInput })
    setCurrentInput('')
    setError('')
    setStage('message')
  }

  const handleMessageSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentInput.trim()) {
      setError('Please enter a message')
      return
    }
    setFormData({ ...formData, message: currentInput })
    setError('')
    setStage('sending')

    // Send email via API
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: currentInput,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      setStage('success')
    } catch (err) {
      setError('Failed to send message. Please try again.')
      setStage('message')
    }
  }

  return (
    <section id="contact" className="py-20 px-6 bg-slate/5">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-serif font-bold text-charcoal mb-12">
          Contact
        </h2>

        <div className="bg-white rounded-lg shadow-sm p-6 md:p-8 min-h-[400px] flex flex-col">
          {/* Chat messages */}
          <div className="flex-1 space-y-4 mb-6">
            {/* Initial bot message */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm">💬</span>
              </div>
              <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                <p className="text-charcoal">
                  Have a question or want to connect? Send me a message.
                </p>
              </div>
            </div>

            {/* Name bubble (after name submitted) */}
            {stage !== 'initial' && (
              <div className="flex justify-end">
                <div className="bg-teal text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                  <p>{formData.name}</p>
                </div>
              </div>
            )}

            {/* Bot asks for email */}
            {(stage === 'email' || stage === 'message' || stage === 'sending' || stage === 'success') && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">💬</span>
                </div>
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                  <p className="text-charcoal">
                    Nice to meet you, {formData.name}! What's your email?
                  </p>
                </div>
              </div>
            )}

            {/* Email bubble (after email submitted) */}
            {(stage === 'message' || stage === 'sending' || stage === 'success') && (
              <div className="flex justify-end">
                <div className="bg-teal text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                  <p>{formData.email}</p>
                </div>
              </div>
            )}

            {/* Bot asks for message */}
            {(stage === 'message' || stage === 'sending' || stage === 'success') && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">💬</span>
                </div>
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                  <p className="text-charcoal">Great! What would you like to share?</p>
                </div>
              </div>
            )}

            {/* Message bubble (after message submitted) */}
            {(stage === 'sending' || stage === 'success') && formData.message && (
              <div className="flex justify-end">
                <div className="bg-teal text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%]">
                  <p>{formData.message}</p>
                </div>
              </div>
            )}

            {/* Success message */}
            {stage === 'success' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">✓</span>
                </div>
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%]">
                  <p className="text-charcoal">
                    Thanks! I'll be in touch soon.
                  </p>
                </div>
              </div>
            )}

            {/* Sending indicator */}
            {stage === 'sending' && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-teal/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">💬</span>
                </div>
                <div className="bg-slate/10 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          {stage === 'initial' && (
            <form onSubmit={handleNameSubmit} className="space-y-2">
              <input
                type="text"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                className="w-full bg-teal text-white px-6 py-3 rounded-lg hover:bg-teal-dark transition-colors font-medium"
              >
                Continue
              </button>
            </form>
          )}

          {stage === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-2">
              <input
                type="email"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                className="w-full bg-teal text-white px-6 py-3 rounded-lg hover:bg-teal-dark transition-colors font-medium"
              >
                Continue
              </button>
            </form>
          )}

          {stage === 'message' && (
            <form onSubmit={handleMessageSubmit} className="space-y-2">
              <textarea
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                placeholder="Your message..."
                rows={4}
                className="w-full px-4 py-3 border border-slate/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal/50 focus:border-teal resize-none"
                autoFocus
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                type="submit"
                className="w-full bg-teal text-white px-6 py-3 rounded-lg hover:bg-teal-dark transition-colors font-medium"
              >
                Send Message
              </button>
            </form>
          )}

          {stage === 'success' && (
            <button
              onClick={() => {
                setStage('initial')
                setFormData({ name: '', email: '', message: '' })
                setCurrentInput('')
              }}
              className="w-full bg-slate/10 text-charcoal px-6 py-3 rounded-lg hover:bg-slate/20 transition-colors font-medium"
            >
              Send Another Message
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
