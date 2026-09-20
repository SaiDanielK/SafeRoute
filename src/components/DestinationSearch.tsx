import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

type Destination = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type DestinationSearchProps = {
  onSelectDestination: (
    destination: Destination
  ) => void;
};

type PeliasFeature = {
  geometry?: {
    coordinates?: [
      number,
      number
    ];
  };

  properties?: {
    name?: string;
    label?: string;
    street?: string;
    housenumber?: string;
    locality?: string;
    county?: string;
    region?: string;
    country?: string;
    postalcode?: string;
  };
};

type PeliasResponse = {
  features?: PeliasFeature[];
};

const ORS_API_KEY =
  process.env.EXPO_PUBLIC_ORS_API_KEY;

const AUTOCOMPLETE_DELAY_MS = 350;

function formatAddress(
  properties: PeliasFeature["properties"]
): string {
  if (!properties) {
    return "Location";
  }

  const parts: string[] = [];

  if (
    properties.housenumber &&
    properties.street
  ) {
    parts.push(
      `${properties.housenumber} ${properties.street}`
    );
  } else if (properties.street) {
    parts.push(properties.street);
  }

  if (properties.locality) {
    parts.push(properties.locality);
  }

  if (properties.region) {
    parts.push(properties.region);
  }

  if (properties.postalcode) {
    parts.push(properties.postalcode);
  }

  if (parts.length > 0) {
    return parts.join(", ");
  }

  if (properties.label) {
    return properties.label;
  }

  return "Location";
}

function getDestinationFromFeature(
  feature: PeliasFeature
): Destination | null {
  const coordinates =
    feature.geometry?.coordinates;

  if (
    !coordinates ||
    coordinates.length < 2
  ) {
    return null;
  }

  const [
    longitude,
    latitude,
  ] = coordinates;

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }

  const properties =
    feature.properties ?? {};

  const name =
    properties.name ||
    properties.label ||
    "Selected location";

  return {
    name,
    address: formatAddress(properties),
    latitude,
    longitude,
  };
}

export default function DestinationSearch({
  onSelectDestination,
}: DestinationSearchProps) {
  const [query, setQuery] =
    useState("");

  const [results, setResults] =
    useState<Destination[]>([]);

  const [loading, setLoading] =
    useState(false);

  const requestIdRef =
    useRef(0);

  const searchTimeoutRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(
          searchTimeoutRef.current
        );
      }
    };
  }, []);

  async function searchDestination(
    searchText = query
  ) {
    const trimmedQuery =
      searchText.trim();

    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    const requestId =
      ++requestIdRef.current;

    if (!ORS_API_KEY) {
      console.error(
        "SafeRoute: EXPO_PUBLIC_ORS_API_KEY is missing."
      );

      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const params =
        new URLSearchParams({
          text: trimmedQuery,
          size: "5",
          "layers":
            "address,venue,locality,neighbourhood",
          api_key: ORS_API_KEY,
        });

      const response =
        await fetch(
          `https://api.heigit.org/pelias/v1/autocomplete?${params.toString()}`,
          {
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      if (!response.ok) {
        throw new Error(
          `Autocomplete request failed: ${response.status}`
        );
      }

      const data =
        (await response.json()) as PeliasResponse;

      if (
        requestId !==
        requestIdRef.current
      ) {
        return;
      }

      const formattedResults =
        (data.features ?? [])
          .map(
            getDestinationFromFeature
          )
          .filter(
            (
              destination
            ): destination is Destination =>
              destination !== null
          )
          .slice(0, 5);

      setResults(
        formattedResults
      );
    } catch (error) {
      if (
        requestId !==
        requestIdRef.current
      ) {
        return;
      }

      console.error(
        "Destination autocomplete error:",
        error
      );

      setResults([]);
    } finally {
      if (
        requestId ===
        requestIdRef.current
      ) {
        setLoading(false);
      }
    }
  }

  function scheduleAutocomplete(
    text: string
  ) {
    if (searchTimeoutRef.current) {
      clearTimeout(
        searchTimeoutRef.current
      );
    }

    const trimmedText =
      text.trim();

    if (
      trimmedText.length < 2
    ) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    searchTimeoutRef.current =
      setTimeout(() => {
        searchDestination(
          text
        );
      }, AUTOCOMPLETE_DELAY_MS);
  }

  function handleChangeText(
    text: string
  ) {
    setQuery(text);

    scheduleAutocomplete(
      text
    );
  }

  function selectDestination(
    destination: Destination
  ) {
    if (searchTimeoutRef.current) {
      clearTimeout(
        searchTimeoutRef.current
      );
    }

    Keyboard.dismiss();

    setQuery(
      destination.name
    );

    setResults([]);

    setLoading(false);

    onSelectDestination(
      destination
    );
  }

  function clearSearch() {
    if (searchTimeoutRef.current) {
      clearTimeout(
        searchTimeoutRef.current
      );
    }

    ++requestIdRef.current;

    setQuery("");
    setResults([]);
    setLoading(false);
  }

  function handleSubmit() {
    if (searchTimeoutRef.current) {
      clearTimeout(
        searchTimeoutRef.current
      );
    }

    Keyboard.dismiss();

    searchDestination();
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <View
          style={
            styles.searchIconContainer
          }
        >
          <Ionicons
            name="search"
            size={20}
            color="#20C997"
          />
        </View>

        <TextInput
          style={styles.input}
          value={query}
          onChangeText={
            handleChangeText
          }
          placeholder="Where are you going?"
          placeholderTextColor="#71889C"
          returnKeyType="search"
          onSubmitEditing={
            handleSubmit
          }
          autoCorrect={false}
          autoCapitalize="words"
        />

        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="small"
              color="#20C997"
            />
          </View>
        ) : query.length > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.clearButton,
              pressed &&
                styles.clearPressed,
            ]}
            onPress={
              clearSearch
            }
            hitSlop={6}
          >
            <Ionicons
              name="close"
              size={18}
              color="#A9BDD1"
            />
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.searchButton,
            pressed &&
              styles.searchButtonPressed,
          ]}
          onPress={
            handleSubmit
          }
          disabled={loading}
          hitSlop={4}
        >
          <Ionicons
            name="search"
            size={19}
            color="#04110D"
          />
        </Pressable>
      </View>

      {results.length > 0 && (
        <View style={styles.results}>
          {results.map(
            (
              destination,
              index
            ) => (
              <Pressable
                key={`${destination.latitude}-${destination.longitude}-${index}`}
                style={({ pressed }) => [
                  styles.result,
                  pressed &&
                    styles.resultPressed,
                  index ===
                    results.length -
                      1 &&
                    styles.lastResult,
                ]}
                onPress={() =>
                  selectDestination(
                    destination
                  )
                }
              >
                <View
                  style={
                    styles.resultIcon
                  }
                >
                  <Ionicons
                    name="location-outline"
                    size={19}
                    color="#20C997"
                  />
                </View>

                <View
                  style={
                    styles.resultContent
                  }
                >
                  <Text
                    style={
                      styles.resultName
                    }
                    numberOfLines={1}
                  >
                    {
                      destination.name
                    }
                  </Text>

                  <Text
                    style={
                      styles.resultAddress
                    }
                    numberOfLines={1}
                  >
                    {
                      destination.address
                    }
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color="#607C92"
                />
              </Pressable>
            )
          )}
        </View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      width: "100%",
    },

    searchRow: {
      height: 58,
      borderRadius: 19,
      backgroundColor: "#0C1D2E",
      borderWidth: 1,
      borderColor: "#21415B",
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 9,
      paddingRight: 7,

      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 8,
    },

    searchIconContainer: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor:
        "#123451",
      alignItems: "center",
      justifyContent: "center",
    },

    input: {
      flex: 1,
      height: "100%",
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "600",
      paddingHorizontal: 12,
    },

    loadingContainer: {
      width: 34,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },

    clearButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor:
        "#1A3043",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 5,
    },

    clearPressed: {
      opacity: 0.65,
    },

    searchButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#20C997",
      alignItems: "center",
      justifyContent: "center",

      shadowColor: "#20C997",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },

    searchButtonPressed: {
      opacity: 0.7,
      transform: [
        { scale: 0.94 },
      ],
    },

    results: {
      marginTop: 8,
      backgroundColor:
        "#0C1D2E",
      borderRadius: 18,
      borderWidth: 1,
      borderColor: "#21415B",
      overflow: "hidden",

      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 8,
      },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 12,
    },

    result: {
      minHeight: 66,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor:
        "#173650",
    },

    lastResult: {
      borderBottomWidth: 0,
    },

    resultPressed: {
      backgroundColor:
        "#112A3E",
    },

    resultIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      backgroundColor:
        "#123451",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 11,
    },

    resultContent: {
      flex: 1,
    },

    resultName: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    resultAddress: {
      color: "#71899E",
      fontSize: 11,
      marginTop: 4,
    },
  });