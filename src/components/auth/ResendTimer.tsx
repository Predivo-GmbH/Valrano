import { useState, useEffect, useCallback } from 'react'

interface ResendTimerProps {
  onResend: () => Promise<void>
  cooldown?: number
}

export default function ResendTimer({ onResend, cooldown = 60 }: ResendTimerProps) {
  const [seconds, setSeconds] = useState(cooldown)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (seconds <= 0) return
    const timer = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(timer)
  }, [seconds])

  const handleResend = useCallback(async () => {
    setSending(true)
    try {
      await onResend()
      setSeconds(cooldown)
    } finally {
      setSending(false)
    }
  }, [onResend, cooldown])

  if (seconds > 0) {
    return (
      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Resend code in {seconds}s
      </p>
    )
  }

  return (
    <button
      onClick={handleResend}
      disabled={sending}
      className="block w-full text-center text-sm font-medium text-[var(--color-accent)] hover:underline disabled:opacity-50"
    >
      {sending ? 'Sending...' : 'Resend code'}
    </button>
  )
}
