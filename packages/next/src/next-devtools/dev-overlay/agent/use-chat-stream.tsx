import { useCallback } from 'react'
import type { Message } from './chat-message'

export function useChatStream(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setIsLoading: (loading: boolean) => void
) {
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: 'user',
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])
      setIsLoading(true)

      const assistantMessageIdRef = { current: null as string | null }

      try {
        const response = await fetch('/__nextjs_chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: content,
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')

            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue

              try {
                const data = JSON.parse(line)

                if (data.type === 'start') {
                  // Stream started, keep loading
                } else if (data.type === 'content') {
                  handleStreamContent(
                    data,
                    assistantMessageIdRef.current,
                    setMessages,
                    (id) => {
                      assistantMessageIdRef.current = id
                    }
                  )
                } else if (data.type === 'complete') {
                  handleStreamComplete(
                    data,
                    assistantMessageIdRef.current,
                    setMessages,
                    (id) => {
                      assistantMessageIdRef.current = id
                    }
                  )
                  setIsLoading(false)
                  return
                } else if (data.type === 'error') {
                  handleStreamError(
                    data,
                    assistantMessageIdRef.current,
                    setMessages,
                    (id) => {
                      assistantMessageIdRef.current = id
                    }
                  )
                  setIsLoading(false)
                  return
                }
              } catch (parseError) {
                console.warn('Failed to parse streaming response:', line)
              }
            }
          }
        } finally {
          reader.releaseLock()
        }
      } catch (error) {
        console.error('Chat streaming error:', error)

        const errorContent = `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`

        if (!assistantMessageIdRef.current) {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: errorContent,
            role: 'assistant',
            timestamp: new Date(),
          }
          setMessages((prev) => [...prev, errorMessage])
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageIdRef.current
                ? { ...msg, content: errorContent }
                : msg
            )
          )
        }
      } finally {
        setIsLoading(false)
      }
    },
    [setMessages, setIsLoading]
  )

  return { sendMessage }
}

function handleStreamContent(
  data: any,
  assistantMessageId: string | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setAssistantId: (id: string) => void
) {
  if (!assistantMessageId) {
    const newId = (Date.now() + 1).toString()
    setAssistantId(newId)
    const assistantMessage: Message = {
      id: newId,
      content: data.content || '',
      role: 'assistant',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
  } else {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? { ...msg, content: msg.content + (data.content || '') }
          : msg
      )
    )
  }
}

function handleStreamComplete(
  data: any,
  assistantMessageId: string | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setAssistantId: (id: string) => void
) {
  if (!assistantMessageId) {
    const newId = (Date.now() + 1).toString()
    setAssistantId(newId)
    const assistantMessage: Message = {
      id: newId,
      content: data.content || '',
      role: 'assistant',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
  } else {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? { ...msg, content: data.content || msg.content }
          : msg
      )
    )
  }
}

function handleStreamError(
  data: any,
  assistantMessageId: string | null,
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  setAssistantId: (id: string) => void
) {
  const errorContent = `Error: ${data.content || 'Unknown error'}`

  if (!assistantMessageId) {
    const newId = (Date.now() + 1).toString()
    setAssistantId(newId)
    const assistantMessage: Message = {
      id: newId,
      content: errorContent,
      role: 'assistant',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMessage])
  } else {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId ? { ...msg, content: errorContent } : msg
      )
    )
  }
}
