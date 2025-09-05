import { useState } from 'react'
import { ChatHeader } from './chat-header'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { useChatMessages } from './use-chat-messages'
import { useChatStream } from './use-chat-stream'
import './chat-interface.css'

interface ChatInterfaceProps {
  onClose?: () => void
}

export function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const { messages, setMessages, isLoading, setIsLoading } = useChatMessages()
  const { sendMessage } = useChatStream(setMessages, setIsLoading)

  const handleToggleMinimize = () => {
    setIsMinimized((prev) => !prev)
  }

  const handleSubmitMessage = async (content: string) => {
    if (isLoading) return
    await sendMessage(content)
  }

  return (
    <div className={`chatContainer ${isMinimized ? 'minimized' : ''}`}>
      <ChatHeader
        onClose={onClose || (() => {})}
        onToggleMinimize={handleToggleMinimize}
        isMinimized={isMinimized}
      />

      {!isMinimized && (
        <>
          <div className="chatContent">
            <div className="messagesContainer">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isLoading && (
                <div className="messageGroup">
                  <div className="messageContent assistant">
                    <p style={{ margin: 0, color: '#9ca3af' }}>Thinking...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <ChatInput
            onSubmit={handleSubmitMessage}
            disabled={isLoading}
            placeholder="Ask a question..."
          />
        </>
      )}
    </div>
  )
}
