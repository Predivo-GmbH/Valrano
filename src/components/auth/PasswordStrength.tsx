import { getPasswordScore } from './password-utils'

const COLORS = ['bg-[var(--color-destructive)]', 'bg-[var(--color-signal-amber)]', 'bg-[var(--color-signal-amber)]', 'bg-[var(--color-primary)]', 'bg-[var(--color-signal-green)]']
const LABELS = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']

export default function PasswordStrength({ password, id }: { password: string; id?: string }) {
  const score = getPasswordScore(password)
  if (!password) return null

  const strengthLabel = LABELS[score - 1] ?? 'Very weak'

  return (
    <div id={id} className="mt-2">
      <div className="flex gap-1" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={5} aria-label={`Password strength: ${strengthLabel}`}>
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < score ? COLORS[score - 1] : 'bg-[var(--color-border)]'
            }`}
          />
        ))}
      </div>
      <span className="sr-only">Password strength: {strengthLabel}</span>
    </div>
  )
}
