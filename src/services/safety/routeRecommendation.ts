export type RouteRecommendationCandidate = {
  score: number | null;
  durationSeconds: number;
};

export type RouteComparison = {
  fastestIndex: number;
  safestIndex: number;
  sameRoute: boolean;
  safetyDifference: number;
  timeDifferenceSeconds: number;
};

export function getRecommendedRouteIndex(
  routes: RouteRecommendationCandidate[]
): number {
  if (routes.length === 0) {
    return -1;
  }

  let recommendedIndex = 0;
  let highestScore: number | null = null;

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];

    if (!route || route.score === null) {
      continue;
    }

    if (
      highestScore === null ||
      route.score > highestScore ||
      (route.score === highestScore &&
        route.durationSeconds <
          (routes[recommendedIndex]?.durationSeconds ??
            Number.POSITIVE_INFINITY))
    ) {
      recommendedIndex = index;
      highestScore = route.score;
    }
  }

  return recommendedIndex;
}

export function getRouteComparison(
  routes: RouteRecommendationCandidate[]
): RouteComparison | null {
  if (routes.length === 0) {
    return null;
  }

  let fastestIndex = 0;

  for (let index = 1; index < routes.length; index += 1) {
    const route = routes[index];
    const fastest = routes[fastestIndex];

    if (
      route &&
      fastest &&
      route.durationSeconds < fastest.durationSeconds
    ) {
      fastestIndex = index;
    }
  }

  const safestIndex = getRecommendedRouteIndex(routes);
  const fastest = routes[fastestIndex];
  const safest = routes[safestIndex];

  return {
    fastestIndex,
    safestIndex,
    sameRoute: fastestIndex === safestIndex,
    safetyDifference:
      (safest?.score ?? 50) - (fastest?.score ?? 50),
    timeDifferenceSeconds:
      (safest?.durationSeconds ?? 0) -
      (fastest?.durationSeconds ?? 0),
  };
}
