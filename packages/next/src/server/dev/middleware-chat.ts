import type { IncomingMessage, ServerResponse } from 'http'
import { middlewareResponse } from '../../next-devtools/server/middleware-response'

interface ChatRequest {
  message: string
}

export function getChatMiddleware() {
  return async function (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void
  ): Promise<void> {
    const { pathname } = new URL(`http://n${req.url}`)

    if (pathname !== '/__nextjs_chat') {
      return next()
    }

    // Set CORS headers for development
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.statusCode = 200
      res.end()
      return
    }

    if (req.method !== 'POST') {
      return middlewareResponse.methodNotAllowed(res)
    }

    try {
      const body = await new Promise<string>((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => {
          data += chunk
        })
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })

      const chatRequest: ChatRequest = JSON.parse(body)

      if (!chatRequest.message) {
        return middlewareResponse.badRequest(res)
      }

      // Set up streaming response headers to prevent buffering
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Transfer-Encoding', 'chunked')
      res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering
      res.setHeader('X-Content-Type-Options', 'nosniff')

      // Process the chat request with streaming
      await processStreamingChatRequest(chatRequest, res)
    } catch (error) {
      console.error('Chat middleware error:', error)
      return middlewareResponse.internalServerError(res, error)
    }
  }
}

async function processStreamingChatRequest(
  request: ChatRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const prompt = request.message
    console.log('[Input] Prompt:', prompt)

    // Dynamic import of Claude Code SDK (ES module)
    const { query } = await import('@anthropic-ai/claude-code')

    // Send initial message to test streaming
    res.write(JSON.stringify({ type: 'start' }) + '\n')

    // Stream messages from Claude Code SDK
    for await (const message of query({
      prompt,
      options: {
        maxTurns: 20, // Allow multiple turns for complex tasks
        customSystemPrompt:
          'You are Claude, helping with Next.js development. Keep responses concise and helpful. Focus on practical advice and solutions.',
        allowedTools: ['Read', 'Grep', 'Glob'], // Allow file system tools for code analysis
      },
    })) {
      console.log(
        '[Output] Received message type:',
        message.type,
        JSON.stringify(message)
      )

      if (message.type === 'assistant') {
        // Extract content from assistant message
        const content = message.message?.content?.[0]?.text || ''
        if (content) {
          res.write(
            JSON.stringify({
              type: 'content',
              content: content,
            }) + '\n'
          )
        }
      } else if (message.type === 'result') {
        if (message.subtype === 'success') {
          // Send final result
          res.write(
            JSON.stringify({
              type: 'complete',
              content: message.result,
              success: true,
            }) + '\n'
          )
        } else {
          console.error('Claude Code SDK streaming error:', message)
          // Handle specific error types with better messages
          let errorContent =
            'Sorry, I encountered an error processing your request.'

          if (message.subtype === 'error_max_turns') {
            errorContent =
              'The request was too complex and exceeded the maximum conversation turns. Please try breaking it into smaller, more specific questions.'
          } else if (message.subtype === 'error_during_execution') {
            errorContent =
              'An error occurred while processing your request. Please try again or rephrase your question.'
          }

          res.write(
            JSON.stringify({
              type: 'error',
              content: errorContent,
              success: false,
            }) + '\n'
          )
        }
        break
      }
    }

    res.end()
  } catch (error) {
    console.error('Claude Code SDK streaming error:', error)
    res.write(
      JSON.stringify({
        type: 'error',
        content: `Sorry, I encountered an error processing your request. ${JSON.stringify(error)}`,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }) + '\n'
    )
    res.end()
  }
}
