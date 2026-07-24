/**
 * Google Places Autocomplete + Place Details for India address forms.
 * Uses EXPO_PUBLIC_GOOGLE_MAPS_KEY (same key as MapLocationScreen).
 * Enable Places API on the Google Cloud project for this key.
 */

export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};

export type ParsedAddress = {
  line1: string;
  line2: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  formatted: string;
  lat?: number;
  lng?: number;
};

function mapsKey(): string {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY?.trim() ?? '';
  if (!key || key.includes('your_')) return '';
  return key;
}

export function isPlacesAutofillAvailable(): boolean {
  return Boolean(mapsKey());
}

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

function component(
  components: AddressComponent[],
  type: string,
  useShort = false
): string {
  const match = components.find((c) => c.types.includes(type));
  if (!match) return '';
  return (useShort ? match.short_name : match.long_name)?.trim() ?? '';
}

export function parsePlaceAddressComponents(
  components: AddressComponent[],
  formattedAddress?: string
): ParsedAddress {
  const streetNumber = component(components, 'street_number');
  const route = component(components, 'route');
  const premise = component(components, 'premise');
  const subpremise = component(components, 'subpremise');

  const line1Parts = [subpremise, premise, streetNumber, route].filter(Boolean);
  const line1 =
    line1Parts.join(', ') ||
    component(components, 'establishment') ||
    (formattedAddress?.split(',')[0]?.trim() ?? '');

  const line2 =
    component(components, 'neighborhood') ||
    component(components, 'sublocality_level_2') ||
    '';

  const locality =
    component(components, 'sublocality_level_1') ||
    component(components, 'sublocality') ||
    component(components, 'administrative_area_level_3') ||
    component(components, 'neighborhood') ||
    '';

  const city =
    component(components, 'locality') ||
    component(components, 'administrative_area_level_2') ||
    'Bengaluru';

  const state =
    component(components, 'administrative_area_level_1') || 'Karnataka';

  const pincode = component(components, 'postal_code').replace(/\D/g, '').slice(0, 6);

  return {
    line1,
    line2,
    locality: locality || city,
    city,
    state,
    pincode,
    formatted: formattedAddress?.trim() || [line1, locality, city, state, pincode]
      .filter(Boolean)
      .join(', '),
  };
}

export async function fetchPlaceSuggestions(
  input: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const key = mapsKey();
  const q = input.trim();
  if (!key || q.length < 2) return [];

  const url =
    'https://maps.googleapis.com/maps/api/place/autocomplete/json?' +
    new URLSearchParams({
      input: q,
      key,
      components: 'country:in',
      language: 'en',
    }).toString();

  const res = await fetch(url, { signal });
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    predictions?: Array<{
      place_id: string;
      description: string;
      structured_formatting?: {
        main_text?: string;
        secondary_text?: string;
      };
    }>;
  };

  if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    if (__DEV__) {
      console.warn('[places]', data.status, data.error_message);
    }
    return [];
  }

  return (data.predictions ?? []).slice(0, 6).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

export async function fetchPlaceAddress(
  placeId: string,
  signal?: AbortSignal
): Promise<ParsedAddress | null> {
  const key = mapsKey();
  if (!key || !placeId) return null;

  const url =
    'https://maps.googleapis.com/maps/api/place/details/json?' +
    new URLSearchParams({
      place_id: placeId,
      key,
      language: 'en',
      fields: 'address_component,formatted_address,geometry',
    }).toString();

  const res = await fetch(url, { signal });
  const data = (await res.json()) as {
    status?: string;
    result?: {
      address_components?: AddressComponent[];
      formatted_address?: string;
      geometry?: { location?: { lat: number; lng: number } };
    };
  };

  if (data.status !== 'OK' || !data.result?.address_components) {
    if (__DEV__) {
      console.warn('[places] details', data.status);
    }
    return null;
  }

  const parsed = parsePlaceAddressComponents(
    data.result.address_components,
    data.result.formatted_address
  );
  const loc = data.result.geometry?.location;
  if (loc) {
    parsed.lat = loc.lat;
    parsed.lng = loc.lng;
  }
  return parsed;
}
