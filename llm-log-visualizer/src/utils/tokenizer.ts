// Simple tokenizer for token estimation
// Uses a basic approximation: 1 token ≈ 4 characters for English
// For Chinese: 1 token ≈ 1-2 characters

export function estimateTokens(text: string): number {
  // Remove markdown formatting for better estimation
  const cleaned = text
    .replace(/```[\s\S]*?```/g, ' code ')
    .replace(/`[^`]*`/g, ' code ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`]/g, '')

  let tokenCount = 0
  for (const char of cleaned) {
    if (char.charCodeAt(0) > 127) {
      tokenCount += 1.5 // Chinese character
    } else if (char === ' ' || char === '\n') {
      tokenCount += 0
    } else {
      tokenCount += 0.25 // English character
    }
  }

  return Math.ceil(tokenCount)
}

export function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`
  return `${(tokens / 1000).toFixed(1)}k`
}
