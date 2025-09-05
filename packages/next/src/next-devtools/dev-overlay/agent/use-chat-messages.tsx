import { useState } from 'react'
import type { Message } from './chat-message'

export function useChatMessages() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  return {
    messages,
    setMessages,
    isLoading,
    setIsLoading,
  }
}
