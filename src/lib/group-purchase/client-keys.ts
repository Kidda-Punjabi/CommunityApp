/** Client-side hint for which checkout keys need cohort selection (group packages). */
export function checkoutKeyRequiresCohortSelection(checkoutKey: string): boolean {
  return (
    checkoutKey === "foundational-group" ||
    checkoutKey === "beginners-group" ||
    checkoutKey === "beginners" ||
    checkoutKey === "beginners-kids-group"
  );
}
