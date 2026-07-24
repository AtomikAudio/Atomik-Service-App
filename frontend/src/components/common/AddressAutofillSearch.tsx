import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchPlaceAddress,
  fetchPlaceSuggestions,
  isPlacesAutofillAvailable,
  ParsedAddress,
  PlaceSuggestion,
} from '../../services/placesAutocomplete';
import { COLORS } from '../../constants/colors';

interface Props {
  onSelect: (address: ParsedAddress) => void;
  /** Optional label above the search field */
  label?: string;
}

/**
 * Google Places search that autofills address form fields on pick.
 * Hidden when EXPO_PUBLIC_GOOGLE_MAPS_KEY is not set.
 */
export const AddressAutofillSearch: React.FC<Props> = ({
  onSelect,
  label = 'SEARCH ADDRESS',
}) => {
  const available = isPlacesAutofillAvailable();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!available) return null;

  const runSearch = (text: string) => {
    setQuery(text);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (text.trim().length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const list = await fetchPlaceSuggestions(text, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setSuggestions(list);
        }
      } catch (e: unknown) {
        if ((e as { name?: string })?.name === 'AbortError') return;
        setSuggestions([]);
        setError('Could not load suggestions');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 320);
  };

  const pick = async (item: PlaceSuggestion) => {
    setResolving(true);
    setError('');
    setSuggestions([]);
    setQuery(item.mainText);
    try {
      const address = await fetchPlaceAddress(item.placeId);
      if (!address) {
        setError('Could not load that address. Try another suggestion.');
        return;
      }
      onSelect(address);
    } catch {
      setError('Could not load that address. Try again.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Ionicons
          name="search-outline"
          size={18}
          color={COLORS.gray}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={runSearch}
          placeholder="Start typing area, street, or landmark"
          placeholderTextColor={COLORS.grayDark}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
        />
        {(loading || resolving) && (
          <ActivityIndicator
            size="small"
            color={COLORS.red}
            style={styles.spinner}
          />
        )}
        {query.length > 0 && !loading && !resolving ? (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setSuggestions([]);
              setError('');
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={18} color={COLORS.grayDark} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {suggestions.length > 0 ? (
        <View style={styles.list}>
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.placeId}
              style={styles.row}
              onPress={() => void pick(s)}
              activeOpacity={0.85}
              disabled={resolving}
            >
              <Ionicons
                name="location-outline"
                size={18}
                color={COLORS.red}
                style={styles.rowIcon}
              />
              <View style={styles.rowText}>
                <Text style={styles.main} numberOfLines={1}>
                  {s.mainText}
                </Text>
                {s.secondaryText ? (
                  <Text style={styles.secondary} numberOfLines={1}>
                    {s.secondaryText}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      <Text style={styles.hint}>
        Pick a suggestion to autofill the fields below. You can still edit them.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    color: COLORS.grayDark,
    letterSpacing: 2,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  searchIcon: { marginRight: 8 },
  input: {
    flex: 1,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.white,
    paddingVertical: 10,
  },
  spinner: { marginLeft: 8 },
  list: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceElevated,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  rowIcon: { marginTop: 2 },
  rowText: { flex: 1 },
  main: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  secondary: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 3,
  },
  hint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: COLORS.grayDark,
    marginTop: 8,
    lineHeight: 16,
  },
  error: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.red,
    marginTop: 8,
  },
});
