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

    // Kick off background setup: check if address exists, then navigate
    const doSetup = async () => {
      let targetRoute = 'Home';
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          // Check if user has any addresses
          try {
            const existingRes = await api.getMyAddresses(token).catch(() => null);
            const existing = existingRes?.data || [];
            
            if (existing.length === 0) {
              // No address found, navigate to AddressMap to add address
              targetRoute = 'AddressMap';
            } else {
              // Address exists, load it and go to Home
              try {
                await loadUserDefaultAddress();
              } catch {}
              targetRoute = 'Home';
            }
          } catch (e) {
            // If check fails, navigate to AddressMap to add address
            targetRoute = 'AddressMap';
          }
        } else {
          targetRoute = 'Login';
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
    const fallbackTimer = setTimeout(async () => {
      if (!isDone) {
        setIsDone(true);
        const token = await AsyncStorage.getItem('authToken');
        navigation.replace(token ? 'Home' : 'Login');
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
