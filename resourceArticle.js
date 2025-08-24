// resourceArticle.js with Pinch-to-Zoom (Snack Compatible)
// resourceArticle.js with enhanced pinch and double-tap zoom support
import React, { useLayoutEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  TapGestureHandler,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export default function ResourceArticle() {
  const { params } = useRoute();
  const navigation = useNavigation();
  const article = params?.article;
  const [zoomVisible, setZoomVisible] = useState(false);

  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const doubleTapRef = React.useRef();

  const pinchHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      scale.value = event.scale;
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
  });

  const doubleTapHandler = useAnimatedGestureHandler({
    onActive: (event) => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
      } else {
        scale.value = withTiming(2);
        focalX.value = event.x;
        focalY.value = event.y;
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    const originX = focalX.value - width / 2;
    const originY = focalY.value - height / 2;
    return {
      transform: [
        { translateX: originX * (1 - scale.value) },
        { translateY: originY * (1 - scale.value) },
        { scale: scale.value },
      ],
    };
  });

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: article?.title ?? 'Guide' });
  }, [article, navigation]);

  const imageUri = article?.image
    ? Image.resolveAssetSource(article.image).uri
    : null;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.headerCard}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={article.icon || 'information-circle'}
              size={24}
              color="#4F46E5"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{article.title}</Text>
            <Text style={styles.category}>{article.category}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Steps</Text>
          {article.quick.map((q, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.bullet}>
                <Text style={styles.bulletText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{q}</Text>
            </View>
          ))}
        </View>

        {imageUri && (
          <>
            <TouchableOpacity onPress={() => setZoomVisible(true)} activeOpacity={0.9}>
              <View style={styles.imageWrap}>
                <Image
                  source={article.image}
                  style={styles.image}
                  resizeMode="contain"
                />
                <Text style={styles.imageCaption}>Tap to view fullscreen</Text>
              </View>
            </TouchableOpacity>

            <Modal visible={zoomVisible} animationType="fade" transparent={true}>
              <GestureHandlerRootView style={styles.modalBackground}>
                <TapGestureHandler
                  onGestureEvent={doubleTapHandler}
                  numberOfTaps={2}
                  ref={doubleTapRef}
                >
                  <Animated.View style={styles.zoomContainer}>
                    <PinchGestureHandler onGestureEvent={pinchHandler}>
                      <Animated.Image
                        source={{ uri: imageUri }}
                        style={[styles.zoomedImage, animatedStyle]}
                        resizeMode="contain"
                      />
                    </PinchGestureHandler>
                  </Animated.View>
                </TapGestureHandler>
                <TouchableOpacity onPress={() => setZoomVisible(false)} style={styles.closeButton}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
              </GestureHandlerRootView>
            </Modal>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Guidance</Text>
          {article.body.map((p, i) => (
            <Text key={i} style={styles.paragraph}>
              {p}
            </Text>
          ))}
        </View>

        {article.links?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>References</Text>
            {article.links.map((l, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => Linking.openURL(l.url)}
                style={styles.linkRow}>
                <Ionicons name="link" size={16} color="#6366F1" />
                <Text style={styles.linkText}>{l.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>
          This guide is for general first-aid education only and does not replace
          professional medical training or advice. In emergencies, call the local
          emergency number immediately.
        </Text>
      </ScrollView>
    </>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', paddingHorizontal: 16 },
  headerCard: {
    marginTop: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  category: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  bullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { color: '#4F46E5', fontWeight: '700', fontSize: 12 },
  stepText: { flex: 1, color: '#111827' },
  paragraph: { color: '#111827', lineHeight: 20, marginBottom: 8 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  linkText: { color: '#6366F1', fontWeight: '600' },
  disclaimer: {
    color: '#6B7280',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 18,
  },
  imageWrap: {
    marginTop: 14,
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  imageCaption: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: '#000000DD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomedImage: {
    width: width,
    height: height,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#00000099',
    padding: 8,
    borderRadius: 20,
  },
});
