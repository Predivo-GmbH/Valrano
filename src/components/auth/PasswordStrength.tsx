import { getPasswordScore } from './password-utils'

const COLORS = ['bg-[var(--color-destructive)]', 'bg-orange-500', 'bg-amber-500', 'bg-[var(--color-primary)]', 'bg-green-500']

export default function PasswordStrength({ password }: { password: string }) {
  const score = getPasswordScore(password)
  if (!password) return null

  return (
    <div className="mt-2 flex gap-1" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={5} aria-label="Password strength">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-colors ${
            i < score ? COLORS[score - 1] : 'bg-[var(--color-border)]'
          }`}
        />
      ))}
    </div>
  )
}
