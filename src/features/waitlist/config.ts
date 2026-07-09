/**
 * Master switch for public self-service registration.
 *
 * While `false` (pre-launch): every sign-up CTA opens the waitlist modal and the
 * /signup route shows the waitlist instead of the signup form. Sign-IN still works
 * (existing users can log in). To REOPEN registration, flip this to `true` — the
 * /signup form is preserved and comes back — and the CTAs go back to /signup.
 *
 * Typed as boolean (not the literal `false`) so both branches stay reachable and
 * TypeScript doesn't flag the preserved signup form as dead code.
 */
export const REGISTRATIONS_OPEN: boolean = false
