/**
 * What is actually true about auth email when setting SEND_EMAIL_INTERNAL_SECRET fails.
 *
 * WHY THIS EXISTS. seed-email-relay-vault.mjs used to print, on that failure:
 *
 *   "enforcement is OFF, which is the safe side: auth email still flows."
 *
 * That sentence is true for a FIRST seeding and false for every rotation. The default path mints a
 * new secret and overwrites Vault BEFORE it touches the edge variable, so once the Vault write has
 * landed the relay is already signing with the NEW value. If the edge POST then fails, the edge
 * function is still enforcing the OLD one — and send-auth-email rejects every auth email at exactly
 * the moment the script says it still flows. Whoever read that line would go looking somewhere else.
 *
 * The fix is not a better sentence: it is to stop asserting and compare what the two sides hold.
 * The Management API returns each edge secret's SHA-256 rather than its value, so this comparison
 * needs no secret and reveals none — a digest in, a digest in, a verdict out.
 */

/**
 * @param {object} o
 * @param {boolean} o.edgeSecretExistedBefore  was SEND_EMAIL_INTERNAL_SECRET set before the POST
 * @param {string|null} o.edgeDigestBefore     its SHA-256 as the Management API reported it, or null
 * @param {string} o.vaultDigestNow            SHA-256 of the secret the relay is sending NOW
 * @returns {{authEmailBroken: boolean, message: string}}
 */
export function enforcementVerdict({ edgeSecretExistedBefore, edgeDigestBefore, vaultDigestNow }) {
  if (!edgeSecretExistedBefore) {
    return {
      authEmailBroken: false,
      message:
        'enforcement was never turned on here (the edge secret does not exist), so nothing is ' +
        'rejecting anything: auth email still flows. Safe to re-run.',
    }
  }
  if (edgeDigestBefore && edgeDigestBefore === vaultDigestNow) {
    return {
      authEmailBroken: false,
      message:
        'the edge side already holds exactly the value the relay is sending, so the failed write ' +
        'changed nothing: auth email still flows. Safe to re-run.',
    }
  }
  return {
    authEmailBroken: true,
    message:
      'AUTH EMAIL IS BEING REJECTED RIGHT NOW. Vault has already been updated, so the relay signs ' +
      'with the new secret, while the edge function is still enforcing the old one — every ' +
      'password reset, magic link and sign-up confirmation fails until the two agree. Re-run this ' +
      'script immediately; if it keeps failing, remove SEND_EMAIL_INTERNAL_SECRET from the project ' +
      'to turn enforcement off, which restores delivery while you fix the cause.',
  }
}
