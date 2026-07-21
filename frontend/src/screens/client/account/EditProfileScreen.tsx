import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { AccountScreenLayout } from '../../../components/common/AccountScreenLayout';
import { Input } from '../../../components/common/Input';
import { Button } from '../../../components/common/Button';
import { authService } from '../../../services/auth';
import { updateUser } from '../../../store/authSlice';
import { COLORS } from '../../../constants/colors';
import {
  ensureCameraAccessAsync,
  ensureGalleryAccessAsync,
} from '../../../utils/imagePickerPermissions';

interface Props {
  navigation: any;
}

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.auth.user);
  const isAdmin = user?.role === 'admin';
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);

  const uploadPickedPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const updated = await authService.uploadAvatar(uri);
      setAvatar(updated.avatar);
      dispatch(
        updateUser({
          avatar: updated.avatar,
          name: updated.name,
          phone: updated.phone,
        })
      );
      Alert.alert('Photo updated', 'Your profile picture was saved.');
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const takePhoto = async () => {
    setChooserOpen(false);
    if (!(await ensureCameraAccessAsync())) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await uploadPickedPhoto(result.assets[0].uri);
  };

  const chooseFromGallery = async () => {
    setChooserOpen(false);
    if (!(await ensureGalleryAccessAsync())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    await uploadPickedPhoto(result.assets[0].uri);
  };

  const save = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name is required.');
      return;
    }
    if (!isAdmin && !phone.trim()) {
      Alert.alert('Required', 'Phone number is required.');
      return;
    }
    setLoading(true);
    try {
      const updated = await authService.updateProfile({
        name: name.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
      });
      dispatch(updateUser(updated));
      Alert.alert('Saved', 'Profile updated successfully.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountScreenLayout title="Edit Profile" keyboard>
      <View style={styles.avatarBlock}>
        <TouchableOpacity
          style={styles.avatarWrap}
          onPress={() => setChooserOpen(true)}
          disabled={uploadingPhoto}
          activeOpacity={0.8}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={36} color={COLORS.gray} />
            </View>
          )}
          <View style={styles.avatarBadge}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="camera" size={14} color={COLORS.white} />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Tap to change profile photo</Text>
      </View>

      <View style={styles.form}>
        <Input label="Full name" value={name} onChangeText={setName} icon="person-outline" />
        <Input
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon="call-outline"
          placeholder={isAdmin ? 'Optional for admin' : 'Your mobile number'}
        />
        <Input
          label="Email"
          value={user?.email ?? ''}
          editable={false}
          icon="mail-outline"
        />
        <Button label="SAVE CHANGES" onPress={save} loading={loading} style={styles.btn} />
      </View>

      <Modal
        visible={chooserOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setChooserOpen(false)}
      >
        <Pressable
          style={styles.sheetOverlay}
          onPress={() => setChooserOpen(false)}
        >
          <Pressable style={styles.sheet} onPress={() => undefined}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profile photo</Text>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <View style={styles.sheetOptionIcon}>
                <Ionicons name="camera-outline" size={20} color={COLORS.white} />
              </View>
              <Text style={styles.sheetOptionLabel}>Take photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetOption}
              onPress={chooseFromGallery}
              activeOpacity={0.7}
            >
              <View style={styles.sheetOptionIcon}>
                <Ionicons name="images-outline" size={20} color={COLORS.white} />
              </View>
              <Text style={styles.sheetOptionLabel}>Choose from gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetCancel}
              onPress={() => setChooserOpen(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetCancelLabel}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </AccountScreenLayout>
  );
};

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 8,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  avatarHint: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 8,
  },
  form: {
    width: '100%',
  },
  btn: { marginTop: 8 },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surfaceElevated,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 14,
  },
  sheetTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 12,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  sheetOptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: COLORS.white,
  },
  sheetCancel: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  sheetCancelLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: COLORS.gray,
    letterSpacing: 0.5,
  },
});
