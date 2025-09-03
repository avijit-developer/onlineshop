import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';

const VendorAuth = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const loginVendor = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.request('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      if (res?.token) {
        await AsyncStorage.setItem('vendorAuthToken', res.token);
        navigation.replace('VendorTabs');
      } else {
        Alert.alert('Login failed', res?.message || 'Invalid credentials');
      }
    } catch (e) {
      Alert.alert('Login failed', e?.message || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={{ position: 'absolute', left: 16, top: 28 }} onPress={() => navigation.goBack()}>
        <Text style={{ color: '#f7ab18', fontWeight: '700' }}>{'< Back'}</Text>
      </TouchableOpacity>
      <Image source={require('../../src/assets/logo.jpg')} style={{ width: 80, height: 80, marginBottom: 12 }} />
      <Text style={styles.title}>Vendor Login</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <TouchableOpacity style={styles.btn} onPress={loginVendor} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={{ color: '#f7ab18', fontWeight: '700' }}>Create Account</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
          <Text style={{ color: '#f7ab18', fontWeight: '700' }}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#333' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#f9f9f9', color: '#000' },
  btn: { width: '100%', backgroundColor: '#f7ab18', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});

export default VendorAuth;