
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedDestination = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

const STORAGE_KEY = "@saferoute/saved-destinations/v1";

export async function getSavedDestinations(): Promise<SavedDestination[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((item): item is SavedDestination => {
      return (
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.address === "string" &&
        typeof item.latitude === "number" &&
        typeof item.longitude === "number" &&
        Number.isFinite(item.latitude) &&
        Number.isFinite(item.longitude)
      );
    });
  } catch (error) {
    console.error("Failed to load saved destinations:", error);
    return [];
  }
}

export async function saveDestination(
  destination: SavedDestination
): Promise<SavedDestination[]> {
  const current = await getSavedDestinations();
  const updated = [
    ...current.filter((item) => item.id !== destination.id),
    destination,
  ];

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function deleteSavedDestination(
  id: string
): Promise<SavedDestination[]> {
  const current = await getSavedDestinations();
  const updated = current.filter((item) => item.id !== id);

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
