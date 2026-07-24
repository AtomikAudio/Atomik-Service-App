import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Modal,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Share,
  Linking,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';

interface Props {
  images: string[];
  title?: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export const ServiceImagesGallery: React.FC<Props> = ({
  images,
  title = 'Client photos',
}) => {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const urls = (images ?? []).filter(Boolean);

  if (urls.length === 0) return null;

  const open = (index: number) => setViewerIndex(index);
  const close = () => setViewerIndex(null);

  const currentUrl =
    viewerIndex != null && viewerIndex >= 0 && viewerIndex < urls.length
      ? urls[viewerIndex]
      : null;

  const shareOrDownload = async () => {
    if (!currentUrl) return;
    try {
      await Share.share({
        message: currentUrl,
        url: currentUrl,
        title: 'Reference photo',
      });
    } catch {
      try {
        await Linking.openURL(currentUrl);
      } catch {
        Alert.alert('Could not open', 'Copy the image link from the job details.');
      }
    }
  };

  const openInBrowser = async () => {
    if (!currentUrl) return;
    try {
      await Linking.openURL(currentUrl);
    } catch {
      Alert.alert('Could not open image');
    }
  };

  return (
    <View>
      <Text style={styles.blockLabel}>{title.toUpperCase()}</Text>
      <View style={styles.row}>
        {urls.map((uri, i) => (
          <TouchableOpacity
            key={`${uri}-${i}`}
            style={styles.thumbWrap}
            onPress={() => open(i)}
            activeOpacity={0.85}
          >
            <Image source={{ uri }} style={styles.thumb} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={viewerIndex != null}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.viewer}>
          <View style={styles.viewerTop}>
            <TouchableOpacity onPress={close} style={styles.viewerBtn} hitSlop={12}>
              <Ionicons name="close" size={26} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.viewerCount}>
              {viewerIndex != null ? viewerIndex + 1 : 0} / {urls.length}
            </Text>
            <View style={styles.viewerActions}>
              <TouchableOpacity
                onPress={shareOrDownload}
                style={styles.viewerBtn}
                hitSlop={12}
              >
                <Ionicons name="download-outline" size={24} color={COLORS.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={openInBrowser}
                style={styles.viewerBtn}
                hitSlop={12}
              >
                <Ionicons name="open-outline" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          {currentUrl ? (
            <ScrollView
              style={styles.zoomScroll}
              contentContainerStyle={styles.zoomContent}
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              bouncesZoom
            >
              <Pressable onPress={close}>
                <Image
                  source={{ uri: currentUrl }}
                  style={styles.fullImage}
                  resizeMode="contain"
                />
              </Pressable>
            </ScrollView>
          ) : null}

          {urls.length > 1 ? (
            <View style={styles.navRow}>
              <TouchableOpacity
                style={styles.navBtn}
                disabled={viewerIndex === 0}
                onPress={() =>
                  setViewerIndex((i) => (i != null && i > 0 ? i - 1 : i))
                }
              >
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={viewerIndex === 0 ? COLORS.grayDark : COLORS.white}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.navBtn}
                disabled={viewerIndex === urls.length - 1}
                onPress={() =>
                  setViewerIndex((i) =>
                    i != null && i < urls.length - 1 ? i + 1 : i
                  )
                }
              >
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={
                    viewerIndex === urls.length - 1
                      ? COLORS.grayDark
                      : COLORS.white
                  }
                />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  blockLabel: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    color: COLORS.grayDark,
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  thumbWrap: {
    width: 88,
    height: 88,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  thumb: { width: '100%', height: '100%' },
  viewer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.96)',
    paddingTop: 48,
    paddingBottom: 24,
  },
  viewerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  viewerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerActions: { flexDirection: 'row', alignItems: 'center' },
  viewerCount: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: COLORS.white,
  },
  zoomScroll: { flex: 1 },
  zoomContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 8,
  },
  navBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
