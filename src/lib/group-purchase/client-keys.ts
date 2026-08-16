/** Client-side hint for which checkout keys need cohort selection (group Beginners). */
export function checkoutKeyRequiresCohortSelection(checkoutKey: string): boolean {
  return (
    checkoutKey === "beginners-group" ||
    checkoutKey === "beginners" ||
    checkoutKey === "beginners-kids-group"
  );
}
