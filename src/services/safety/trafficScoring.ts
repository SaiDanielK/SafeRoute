export function scoreTrafficFlow(
  currentSpeed: number,
  freeFlowSpeed: number,
  roadClosure = false
): number {
  if (roadClosure) {
    return 0;
  }

  if (
    !Number.isFinite(currentSpeed) ||
    !Number.isFinite(freeFlowSpeed) ||
    currentSpeed < 0 ||
    freeFlowSpeed <= 0
  ) {
    return 50;
  }

  return Math.round(
    Math.max(
      0,
      Math.min(100, (currentSpeed / freeFlowSpeed) * 100)
    )
  );
}