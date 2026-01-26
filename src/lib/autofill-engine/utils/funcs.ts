const stringifyLog = (value: unknown) => {
    try {
      const seen = new WeakSet()
      return JSON.stringify(
        value,
        (_key, val) => {
          if (typeof val === 'object' && val !== null) {
            if (seen.has(val)) return '[Circular]'
            seen.add(val)
          }
          if (typeof val === 'function') {
            return '[Function]'
          }
          return val
        },
        2
      )
    } catch {
      return String(value)
    }
  }
  
  export const logWithData = (message: string, data?: unknown) => {
    if (typeof data === 'undefined') {
      console.log(message)
      return
    }
    console.log(message, stringifyLog(data))
  }