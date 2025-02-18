import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

// List of allowed commands for security (Windows compatible)
const ALLOWED_COMMANDS = [
  'dir',      // Windows equivalent of ls
  'cd',       // Change directory
  'type',     // Windows equivalent of cat
  'echo',     // Echo text
  'where',    // Windows equivalent of which
  'systeminfo', // System information
  'tasklist', // Windows equivalent of ps
  'netstat',  // Network statistics
  'ping',     // Network ping
  'npm',      // Node package manager
  'node',     // Node.js
  'git'       // Git version control
]

// Helper to check if command is allowed
function isCommandAllowed(command) {
  const baseCommand = command.split(' ')[0].toLowerCase()
  return ALLOWED_COMMANDS.includes(baseCommand)
}

export default async function handler(req, reply) {
  if (req.method !== 'POST') {
    return reply.code(405).send({ error: 'Method not allowed' })
  }

  const { command, cwd } = req.body

  if (!command) {
    return reply.code(400).send({ error: 'Command is required' })
  }

  // Special handling for help command
  if (command === 'help') {
    return reply.send({
      output: `Available commands:
${ALLOWED_COMMANDS.join(', ')}

Common usage:
- dir           List directory contents
- cd <path>     Change directory
- type <file>   Display file contents
- echo <text>   Display text
- systeminfo    Show system information
- tasklist     Show running processes
- netstat      Show network connections

Use these commands to interact with the system.
Note: Some commands may require additional permissions.`
    })
  }

  // Security check
  if (!isCommandAllowed(command)) {
    return reply.code(403).send({
      error: `Command not allowed. Use 'help' to see available commands.`
    })
  }

  try {
    // Special handling for cd command
    if (command.startsWith('cd ')) {
      const newPath = command.slice(3).trim()
      const resolvedPath = path.resolve(cwd || process.cwd(), newPath)
      
      // Security check to prevent navigating outside workspace
      if (!resolvedPath.startsWith(process.cwd())) {
        return reply.code(403).send({
          error: 'Cannot navigate outside workspace directory'
        })
      }

      return reply.send({
        output: '',
        newPath: resolvedPath
      })
    }

    // Execute command
    const { stdout, stderr } = await execAsync(command, {
      cwd: cwd || process.cwd(),
      timeout: 5000, // 5 second timeout
      maxBuffer: 1024 * 1024 // 1MB output limit
    })

    return reply.send({
      output: stdout || stderr
    })
  } catch (error) {
    console.error('Terminal command error:', error)
    return reply.code(500).send({
      error: error.message || 'Failed to execute command'
    })
  }
} 