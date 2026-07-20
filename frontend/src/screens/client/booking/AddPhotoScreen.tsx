import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { BookingFlowHeader } from '../../../components/booking/BookingFlowHeader';
import { useBookingDraft } from '../../../context/BookingDraftContext';
import { COLORS } from '../../../constants/colors';
import { ensureGalleryAccessAsync } from '../../../utils/imagePickerPermissions';

interface Props {
  navigation: any;
}

export const AddPhotoScreen: React.FC<Props> = ({ navigation }) => {
  const { draft, setDraft } = useBookingDraft();
  const [preview, setPreview] = useState<string | null>(
    draft.photos[0] ?? null
  );

  const pick = async (fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Allow camera access to take a photo.');
        return;
      }
    } else if (!(await ensureGalleryAccessAsync())) {
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
    if (!result.canceled && result.assets[0]) {
      setPreview(result.assets[0].uri);
    }
  };

  const save = () => {
    if (!preview) return;
    setDraft((d) => ({
      ...d,
      photos: d.photos.includes(preview) ? d.photos : [...d.photos, preview],
    }));
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('PlaceOrder');
  };

  const skip = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('PlaceOrder');
  };

  return (
    <View style={styles.container}>
      <BookingFlowHeader
        title="Add photo"
        onBack={() => navigation.goBack()}
        rightLabel={preview ? 'Save' : 'Skip'}
        onRight={preview ? save : skip}
      />
      <Text style={styles.optionalNote}>
        Optional — reference photos are not required to place your order.
      </Text>
      <View style={styles.preview}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>
            Rig setup, fault area, or equipment label (optional)
          </Text>
        )}
      </View>
      <TouchableOpacity style={styles.option} onPress={() => pick(false)}>
        <Text style={styles.optionText}>Choose from gallery</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.option} onPress={() => pick(true)}>
        <Text style={styles.optionText}>Take photo</Text>
      </TouchableOpacity>
      {!preview && (
        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>Skip — continue without photos</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  optionalNote: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    paddingHorizontal: 20,
    paddingBottom: 12,
    lineHeight: 18,
  },
  preview: {
    marginHorizontal: 20,
    marginBottom: 16,
    aspectRatio: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: COLORS.grayDark,
    padding: 24,
    textAlign: 'center',
  },
  option: {
    marginHorizontal: 20,
    marginBottom: 10,
    height: 52,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.white,
  },
  skipBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: COLORS.gray,
  },
});
