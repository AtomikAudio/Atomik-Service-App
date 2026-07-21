import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/** iOS requires library permission; Android uses the system photo picker without broad storage access. */
export async function ensureGalleryAccessAsync(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return true;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission needed', 'Allow photo library access to choose an image.');
    return false;
  }

  return true;
}

/** Camera permission is required on both iOS and Android to take a photo. */
export async function ensureCameraAccessAsync(): Promise<boolean> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      'Permission needed',
      'Allow camera access to take a profile photo.'
    );
    return false;
  }

  return true;
}
