import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../contexts/UserContext';
import { useLocation } from '../contexts/LocationContext';
import api from '../utils/api';
import { requestLocationAndGetAddress } from '../utils/locationUtils';

const SignupScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const { register } = useUser();
  const { loadUserDefaultAddress } = useLocation();

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const { firstName, lastName, email, password, confirmPassword } = formData;

    if (!firstName.trim()) {
      Alert.alert('Error', 'Please enter your first name');
      return false;
    }

    if (!lastName.trim()) {
      Alert.alert('Error', 'Please enter your last name');
      return false;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return false;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    if (!acceptTerms) {
      Alert.alert('Error', 'Please accept the Terms and Conditions');
      return false;
    }

    return true;
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const userData = {
        name: `${String(formData.firstName || '').trim()} ${String(formData.lastName || '').trim()}`.trim().replace(/\s+/g, ' '),
        email: formData.email,
        password: formData.password,
      };

      const result = await register(userData);
      
      if (result.success) {
        // Ask location and save default address
        try {
          const location = await requestLocationAndGetAddress();
          const authToken = await AsyncStorage.getItem('authToken');
          if (location && authToken) {
            const addressPayload = {
              label: 'Home',
              name: `${String(formData.firstName || '').trim()} ${String(formData.lastName || '').trim()}`.trim().replace(/\s+/g, ' '),
              address: location.address,
              city: '',
              state: '',
              zipCode: '',
              country: 'United States',
              isDefault: true,
              location: {
                type: 'Point',
                coordinates: [
                  Number(location.longitude),
                  Number(location.latitude)
                ]
              }
            };
            await api.addMyAddress(authToken, addressPayload);
            
            // Refresh location context to show the saved address
            await loadUserDefaultAddress();
          }
        } catch (e) {
          // Non-blocking if address save fails
          console.log('Address save after signup failed:', e?.message);
        }
        // Go to setup screen where animation runs while address is saved
        navigation.replace('Setup');
      } else {
        Alert.alert('Registration Failed', result.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Registration Failed', 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <Text style={styles.welcomeText}>Create Account</Text>
          <Text style={styles.subtitleText}>Join us and start shopping!</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.nameRow}>
            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#999"
                value={formData.firstName}
                onChangeText={(value) => updateFormData('firstName', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <View style={[styles.inputContainer, styles.halfWidth]}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#999"
                value={formData.lastName}
                onChangeText={(value) => updateFormData('lastName', value)}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(value) => updateFormData('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Create a password"
              placeholderTextColor="#999"
              value={formData.password}
              onChangeText={(value) => updateFormData('password', value)}
              secureTextEntry={!showPw1}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPw1(v => !v)} style={{ position: 'absolute', right: 10, top: 36 }}>
              <Icon name={showPw1 ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
            <Text style={styles.passwordHint}>
              Password must be at least 6 characters
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm your password"
              placeholderTextColor="#999"
              value={formData.confirmPassword}
              onChangeText={(value) => updateFormData('confirmPassword', value)}
              secureTextEntry={!showPw2}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPw2(v => !v)} style={{ position: 'absolute', right: 10, top: 36 }}>
              <Icon name={showPw2 ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => setAcceptTerms(!acceptTerms)}
          >
            <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
              {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.termsText}>
              I agree to the{' '}
              <Text
                style={styles.linkText}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('LegalWebView', { title: 'Terms and Conditions', url: 'https://trahimart.com/terms.html' });
                }}
              >
                Terms and Conditions
              </Text> and{' '}
              <Text
                style={styles.linkText}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('LegalWebView', { title: 'Privacy Policy', url: 'https://trahimart.com/privacy.html' });
                }}
              >
                Privacy Policy
              </Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.disabledButton]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            <Text style={styles.signupButtonText}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 30,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 20,
  },
  halfWidth: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#000',
  },
  passwordHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 30,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 12,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  linkText: {
    color: '#f7ab18',
    fontWeight: '600',
  },
  signupButton: {
    backgroundColor: '#f7ab18',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 16,
  },
  loginLink: {
    color: '#f7ab18',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SignupScreen;