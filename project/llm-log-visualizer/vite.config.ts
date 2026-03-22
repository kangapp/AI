import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join } from 'path'

// Absolute path to logs directory
const LOGS_DIR = '/Users/liufukang/workplace/AI/.opencode/logs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'llm-logs-api',
      configureServer(server) {
        // Specific route for file content must come BEFORE the catch-all /api/logs
        server.middlewares.use('/api/logs/:filename', (req, res) => {
          const filename = req.params.filename
          const filePath = join(LOGS_DIR, filename || '')
          try {
            const content = readFileSync(filePath, 'utf-8')
            res.setHeader('Content-Type', 'text/plain')
            res.end(content)
          } catch (e) {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'File not found' }))
          }
        })

        server.middlewares.use('/api/logs', (req, res) => {
          // Only handle exact /api/logs path (not /api/logs/xxx which is handled above)
          if (req.url !== '/api/logs') return

          try {
            if (!existsSync(LOGS_DIR)) {
              res.statusCode = 404
              res.end(JSON.stringify({ error: 'Logs directory not found' }))
              return
            }
            const files = readdirSync(LOGS_DIR)
              .filter(f => f.endsWith('.jsonl'))
              .map(f => ({
                name: f,
                path: join(LOGS_DIR, f),
                modifiedAt: statSync(join(LOGS_DIR, f)).mtime.toISOString()
              }))
              .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())

            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(files))
          } catch (e: any) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      }
    }
  ],
})
