import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestLocationAndGetAddress } from '../utils/locationUtils';
import api from '../utils/api';
import { useLocation } from '../contexts/LocationContext';
import Icon from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');

// Use Ionicons names instead of image assets
const iconNames = [
  'cart-outline',
  'bag-handle-outline',
  'pricetags-outline',
  'storefront-outline',
  'gift-outline',
  'shirt-outline',
  'cube-outline',
  'heart-outline',
];
const iconColors = ['#f59e0b', '#ef4444', '#3b82f6', '#10b981', '#8b5cf6', '#f43f5e'];

const generateRandom = (min, max) => Math.random() * (max - min) + min;

const SetupScreen = ({ navigation, route }) => {
  const { loadUserDefaultAddress } = useLocation();
  const [isDone, setIsDone] = useState(false);
  const animsRef = useRef(
    Array.from({ length: 6 }).map(() => ({
      x: new Animated.Value(generateRandom(0, width - 80)),
      y: new Animated.Value(generateRandom(0, height * 0.4)),
      rotate: new Animated.Value(0),
      scale: new Animated.Value(generateRandom(0.8, 1.2)),
      iconName: iconNames[Math.floor(Math.random() * iconNames.length)],
      color: iconColors[Math.floor(Math.random() * iconColors.length)],
    }))
  );

  useEffect(() => {
    // Start looping animations
    const loops = animsRef.current.map(({ x, y, rotate, scale }) => {
      const move = Animated.loop(
        Animated.sequence([
          Animated.timing(x, { toValue: generateRandom(0, width - 80), duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
          Animated.timing(y, { toValue: generateRandom(0, height * 0.4), duration: 1200, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
        ])
      );
      const spin = Animated.loop(
        Animated.timing(rotate, { toValue: 1, duration: 2400, useNativeDriver: true, easing: Easing.linear })
      );
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.15, duration: 900, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 0.9, duration: 900, useNativeDriver: true }),
        ])
      );
      move.start();
      spin.start(() => rotate.setValue(0));
      pulse.start();
      return () => { move.stop(); spin.stop(); pulse.stop(); };
    });

    // Kick off background setup: fetch location and save address, then navigate
    const doSetup = async () => {
      let targetRoute = 'Home';
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          const location = await requestLocationAndGetAddress();
          if (location) {
            const userDataRaw = await AsyncStorage.getItem('userData');
            const userName = userDataRaw ? (JSON.parse(userDataRaw).name || 'You') : 'You';
            const addressPayload = {
              label: 'Home',
              name: String(userName),
              address: location.address,
              city: '',
              state: '',
              zipCode: '',
              country: 'United States',
              isDefault: true,
              location: {
                type: 'Point',
                coordinates: [Number(location.longitude), Number(location.latitude)],
              },
            };
            try {
              // Deduplicate: fetch existing addresses and avoid re-adding the same one
              const existingRes = await api.getMyAddresses(token).catch(() => null);
              const existing = existingRes?.data || [];
              const round3 = (n) => Math.round(Number(n) * 1000) / 1000;
              const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
              const dup = existing.find((a) => {
                const sameLine = norm(a.address) === norm(addressPayload.address);
                const ex = Array.isArray(a?.location?.coordinates) ? a.location.coordinates : null;
                const sameCoords = ex && round3(ex[1]) === round3(location.latitude) && round3(ex[0]) === round3(location.longitude);
                return sameLine || sameCoords;
              });

              if (dup) {
                // Ensure it's default
                if (!dup.isDefault && dup._id) {
                  try { await api.setDefaultAddress(token, dup._id); } catch (_) {}
                }
              } else {
                await api.addMyAddress(token, addressPayload);
              }
            } catch (e) {
              // Non-blocking: proceed even if address save fails
            }
            try {
              await loadUserDefaultAddress();
            } catch {}
          }
        }
      } catch (e) {
        // ignore
      } finally {
        setIsDone(true);
        // Small delay to let animation finish
        setTimeout(() => navigation.replace(targetRoute), 600);
      }
    };

    // Fallback timeout: don't keep user waiting too long
    const fallbackTimer = setTimeout(() => {
      if (!isDone) {
        setIsDone(true);
        navigation.replace('Home');
      }
    }, 6000);

    doSetup();

    return () => {
      loops.forEach(cancel => cancel && cancel());
      clearTimeout(fallbackTimer);
    };
  }, [navigation, isDone]);

  const renderFloaters = () => (
    animsRef.current.map((a, idx) => {
      const rotateInterpolate = a.rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
      return (
        <Animated.View
          key={idx}
          style={{
            position: 'absolute',
            transform: [
              { translateX: a.x },
              { translateY: a.y },
              { rotate: rotateInterpolate },
              { scale: a.scale },
            ],
          }}
        >
          <Icon name={a.iconName} size={56} color={a.color} />
        </Animated.View>
      );
    })
  );

  return (
    <View style={styles.container}>
      <View style={styles.floaterContainer}>{renderFloaters()}</View>
      <View style={styles.centerBox}>
        <Text style={styles.title}>Setting things up…</Text>
        <Text style={styles.subtitle}>Preparing your shopping experience</Text>
        <Text style={styles.hint}>Fetching your location and saving your default address</Text>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.replace('Home')}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  floaterContainer: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  centerBox: { position: 'absolute', left: 0, right: 0, bottom: 80, alignItems: 'center', paddingHorizontal: 20 },
  title: { fontSize: 24, fontWeight: '700', color: '#222', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', marginBottom: 6 },
  hint: { fontSize: 12, color: '#888' },
  skipBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f7ab18' },
  skipText: { color: '#fff', fontWeight: '600' },
  icon: { width: 64, height: 64, opacity: 0.9 },
});

export default SetupScreen;
