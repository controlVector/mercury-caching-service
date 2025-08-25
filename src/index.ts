import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { MCPHandler } from './mcp/handler'

const PORT = parseInt(process.env.PORT || '3007')
const HOST = process.env.HOST || '0.0.0.0'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
})

// Security and CORS
fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
})

fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// Rate limiting
fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
})

// Initialize MCP Handler
const mcpHandler = new MCPHandler()

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  reply.send({ 
    status: 'healthy',
    service: 'mercury',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// MCP endpoints
fastify.get('/api/v1/mcp/tools', async (request, reply) => {
  try {
    const tools = mcpHandler.getTools()
    reply.send({
      success: true,
      tools,
      count: tools.length
    })
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      error: error.message
    })
  }
})

fastify.get('/api/v1/mcp/health', async (request, reply) => {
  reply.send({
    status: 'healthy',
    service: 'mercury-mcp',
    tools_available: mcpHandler.getTools().length,
    timestamp: new Date().toISOString()
  })
})

fastify.post('/api/v1/mcp/call', async (request, reply) => {
  try {
    const { name: toolName, arguments: args } = request.body as { name: string; arguments: any }
    
    if (!toolName) {
      return reply.status(400).send({
        success: false,
        error: 'Tool name is required'
      })
    }

    fastify.log.info(`Executing Mercury MCP tool: ${toolName}`)
    
    const result = await mcpHandler.handleToolCall(toolName, args || {})
    
    reply.send(result)
  } catch (error: any) {
    fastify.log.error(`Error executing MCP tool: ${error.message}`)
    reply.status(500).send({
      success: false,
      error: error.message,
      tool_name: (request.body as any)?.name || 'unknown'
    })
  }
})

// Repository analysis endpoints
fastify.post('/api/v1/analyze', async (request, reply) => {
  try {
    const args = request.body
    const result = await mcpHandler.handleToolCall('mercury_analyze_repository', args)
    reply.send(result)
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      error: error.message
    })
  }
})

fastify.post('/api/v1/deployment-plan', async (request, reply) => {
  try {
    const args = request.body
    const result = await mcpHandler.handleToolCall('mercury_generate_deployment_plan', args)
    reply.send(result)
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      error: error.message
    })
  }
})

fastify.post('/api/v1/security-scan', async (request, reply) => {
  try {
    const args = request.body
    const result = await mcpHandler.handleToolCall('mercury_detect_security_issues', args)
    reply.send(result)
  } catch (error: any) {
    reply.status(500).send({
      success: false,
      error: error.message
    })
  }
})

// Error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)
  
  reply.status(500).send({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal Server Error',
    timestamp: new Date().toISOString()
  })
})

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST })
    fastify.log.info(`🚀 Mercury Repository Analysis Agent running on ${HOST}:${PORT}`)
    fastify.log.info(`📊 Available MCP tools: ${mcpHandler.getTools().length}`)
    fastify.log.info('🔧 Available endpoints:')
    fastify.log.info('   - GET  /health')
    fastify.log.info('   - GET  /api/v1/mcp/tools')
    fastify.log.info('   - POST /api/v1/mcp/call')
    fastify.log.info('   - POST /api/v1/analyze')
    fastify.log.info('   - POST /api/v1/deployment-plan')
    fastify.log.info('   - POST /api/v1/security-scan')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Handle graceful shutdown
const gracefulShutdown = (signal: string) => {
  fastify.log.info(`Received ${signal}, shutting down gracefully...`)
  fastify.close(() => {
    fastify.log.info('Mercury service stopped')
    process.exit(0)
  })
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'))
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))

start()