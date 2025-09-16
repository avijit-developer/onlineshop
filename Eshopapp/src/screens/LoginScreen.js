import React, { useState } from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { CommonActions } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from 'react-native';
import { useLocation } from '../contexts/LocationContext';
import { useUser } from '../contexts/UserContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { requestLocation, isLoading: locationLoading } = useLocation();
  const [showPw, setShowPw] = useState(false);
  const { login } = useUser();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoggingIn(true);
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // After successful login, request location
        Alert.alert(
          'Location Access',
          'To provide you with better shopping experience, we need access to your location to show nearby stores and delivery options.',
          [
            {
              text: 'Skip',
              style: 'cancel',
              onPress: () => navigation.replace('Home'),
            },
            {
              text: 'Allow Location',
              onPress: async () => {
                await requestLocation();
                navigation.replace('Home');
              },
            },
          ]
        );
      } else {
        Alert.alert('Login Failed', result.error || 'Please check your credentials and try again');
      }
    } catch (error) {
      Alert.alert('Login Failed', 'Please check your credentials and try again');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.formContainer}>
          <Text style={styles.title}>Welcome Back!</Text>
          <Text style={styles.subtitle}>Sign in to continue shopping</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />

          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, { paddingRight: 42 }]}
              placeholder="Password"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={showPw !== true}
              autoCapitalize="none"
              returnKeyType="done"
              selectionColor="#333"
              cursorColor="#333"
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: -10, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
              <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.loginButton, (isLoggingIn || locationLoading) && styles.disabledButton]}
            onPress={handleLogin}
            disabled={isLoggingIn || locationLoading}
          >
            {isLoggingIn || locationLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.linkText}>Create Account</Text>
            </TouchableOpacity>
          </View>

          {/* Vendor login toggle */}
          <View style={{ marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' }}>
            <Text style={{ color: '#666', marginBottom: 8, fontWeight: '600' }}>Vendor Portal</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#f7ab18',
                borderRadius: 8,
                paddingVertical: 12,
                alignItems: 'center'
              }}
              onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'VendorPortal' }] }))}
            >
              <Text style={{ color: '#f7ab18', fontWeight: '700' }}>Enter Vendor Portal</Text>
            </TouchableOpacity>
          </View>

          {/* <TouchableOpacity style={styles.skipButton} onPress={() => navigation.replace('Home')}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity> */}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  formContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    height: 50,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  loginButton: {
    backgroundColor: '#f7ab18',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  linksRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  linkText: {
    color: '#f7ab18',
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#f7ab18',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoginScreen;