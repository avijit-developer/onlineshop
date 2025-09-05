import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import api from '../utils/api';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const SplashScreen = ({ navigation }) => {
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 10,
        friction: 2,
        useNativeDriver: true,
      }),
    ]).start();

    const compareSemver = (a, b) => {
      const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
      const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
      for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0; const nb = pb[i] || 0;
        if (na < nb) return -1;
        if (na > nb) return 1;
      }
      return 0;
    };

    const decide = async () => {
      try {
        // Force update check
        try {
          const res = await api.getShippingSettings();
          const minAppVersion = res?.data?.minAppVersion || '';
          const current = '0.0.1';
          if (minAppVersion && compareSemver(current, minAppVersion) < 0) {
            Alert.alert(
              'Update Required',
              'A newer version of Trahi Mart is required to continue.',
              [
                { text: 'Update', onPress: () => Linking.openURL('https://play.google.com/store/apps/details?id=trahimart') }
              ],
              { cancelable: false }
            );
            return;
          }
        } catch (_) {}
        const vendorToken = await AsyncStorage.getItem('vendorAuthToken');
        if (vendorToken) {
          navigation.replace('VendorPortal');
          return;
        }
        const token = await AsyncStorage.getItem('authToken');
        if (token) { navigation.replace('Home'); return; }
      } catch (e) {}
      navigation.replace('Login');
    };

    const timer = setTimeout(decide, 1200);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <View style={styles.logoPlaceholder}>
          <Image source={require('../assets/logo.jpg')} style={styles.logoImage} resizeMode="cover" />
        </View>
        <Text style={styles.appName}>Trahi Mart</Text>
        <Text style={styles.tagline}>Your Shopping Companion</Text>
      </Animated.View>

      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        <View style={styles.loadingBar}>
          <Animated.View
            style={[
              styles.loadingProgress,
              {
                opacity: fadeAnim,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4A90E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 100,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#E8F4FD',
    fontStyle: 'italic',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
    width: '70%',
  },
});

export default SplashScreen;