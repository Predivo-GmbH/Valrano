// TEMPORARY - deliberate type error, committed only to prove the CI type-check gate
// actually goes red and actually stops the staging deploy. Removed in the next commit.
export function gateProof(): number {
  const n: number = 'this is a string, not a number'
  return n
}
