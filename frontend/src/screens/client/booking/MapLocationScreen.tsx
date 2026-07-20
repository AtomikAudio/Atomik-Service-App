import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { venueService } from '../../../services/venues';
import { COLORS } from '../../../constants/colors';

const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

const mapHtml = (apiKey: string, lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html,body,#map{margin:0;height:100%;background:#231f20}
</style>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}"></script>
</head>
<body>
<div id="map"></div>
<script>
  var pos = { lat: ${lat}, lng: ${lng} };
  var map = new google.maps.Map(document.getElementById('map'), {
    center: pos, zoom: 16,
    styles: [
      { elementType: 'geometry', stylers: [{ color: '#231f20' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#a09f9f' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2b2728' }] },
    ]
  });
  var marker = new google.maps.Marker({ position: pos, map: map, draggable: true });
  marker.addListener('dragend', function() {
    var p = marker.getPosition();
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: p.lat(), lng: p.lng() }));
  });
  map.addListener('click', function(e) {
    marker.setPosition(e.latLng);
    window.ReactNativeWebView.postMessage(JSON.stringify({ lat: e.latLng.lat(), lng: e.latLng.lng() }));
  });
  window.ReactNativeWebView.postMessage(JSON.stringify({ lat: pos.lat, lng: pos.lng }));
</script>
</body>
</html>`;

interface Props {
  navigation: any;
  route?: { params?: { searchQuery?: string } };
}

export const MapLocationScreen: React.FC<Props> = ({ navigation, route }) => {
  const { setDraft } = useBookingDraft();
  const [search, setSearch] = useState(route?.params?.searchQuery ?? '');
  const [coords, setCoords] = useState({ lat: 12.9716, lng: 77.5946 });
  const [addressLabel, setAddressLabel] = useState('Selected map location');
  const [saving, setSaving] = useState(false);
  const webRef = useRef<WebView>(null);

  const centerOnUser = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow location to center the map.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    webRef.current?.reload();
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (places[0]) {
        const p = places[0];
        const line = [p.name, p.street, p.city, p.region].filter(Boolean).join(', ');
        setAddressLabel(line || addressLabel);
        return { city: p.city || 'Bengaluru', area: p.district || p.subregion || 'Area' };
      }
    } catch {
      /* keep defaults */
    }
    return { city: 'Bengaluru', area: 'Map pin' };
  };

  const onDone = async () => {
    setSaving(true);
    try {
      const geo = await reverseGeocode(coords.lat, coords.lng);
      const venue = await venueService.createVenue({
        name: search.trim() || addressLabel.split(',')[0] || 'Venue',
        area: geo.area,
        city: geo.city,
        address: addressLabel,
      });
      setDraft((d) => ({
        ...d,
        venueId: venue._id,
        addressLabel,
        lat: coords.lat,
        lng: coords.lng,
      }));
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('PlaceOrder');
    } catch (e: any) {
      Alert.alert('Could not save location', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!mapsKey || mapsKey.includes('your_')) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackTitle}>Map requires API key</Text>
        <Text style={styles.fallbackText}>
          Set EXPO_PUBLIC_GOOGLE_MAPS_KEY in frontend/.env, or pick a saved venue
          from search.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TextInput
          style={styles.search}
          placeholder="Search location"
          placeholderTextColor={COLORS.grayDark}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      <View style={styles.addressCard}>
        <Text style={styles.addressText} numberOfLines={2}>
          {addressLabel}
        </Text>
      </View>
      <WebView
        ref={webRef}
        style={styles.map}
        source={{ html: mapHtml(mapsKey, coords.lat, coords.lng) }}
        onMessage={(e) => {
          try {
            const { lat, lng } = JSON.parse(e.nativeEvent.data);
            setCoords({ lat, lng });
            reverseGeocode(lat, lng).then(() => {});
          } catch {
            /* ignore */
          }
        }}
      />
      <TouchableOpacity style={styles.locateFab} onPress={centerOnUser}>
        <Ionicons name="locate" size={22} color={COLORS.white} />
      </TouchableOpacity>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={onDone}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.doneText}>DONE</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: COLORS.background,
    zIndex: 2,
  },
  search: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    paddingHorizontal: 14,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addressCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    zIndex: 2,
  },
  addressText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    color: COLORS.gray,
  },
  map: { flex: 1 },
  locateFab: {
    position: 'absolute',
    right: 20,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    padding: 20,
    paddingBottom: 32,
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  doneBtn: {
    height: 52,
    backgroundColor: COLORS.red,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: COLORS.white,
    letterSpacing: 2,
  },
  fallback: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    padding: 32,
  },
  fallbackTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: COLORS.white,
    marginBottom: 12,
  },
  fallbackText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
  },
  backLink: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.red,
    marginTop: 24,
  },
});
