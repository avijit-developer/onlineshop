import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../utils/api';

const VendorAuth = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#fff' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={{ position: 'absolute', left: 16, top: 28 }} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}>
          <Text style={{ color: '#f7ab18', fontWeight: '700' }}>{'< Back'}</Text>
        </TouchableOpacity>
        <Image source={require('../../assets/logo.jpg')} style={styles.logo} />
        <Text style={styles.title}>Vendor Login</Text>
        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} autoCapitalize="none" />
        <View style={{ width: '100%', position: 'relative' }}>
          <TextInput style={[styles.input, { paddingRight: 42 }]} placeholder="Password" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" selectionColor="#333" cursorColor="#333" />
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, height: 48, top: '50%', marginTop: -24, justifyContent: 'center' }}>
            <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.btn} onPress={loginVendor} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', marginTop: 12, gap: 16 }}>
          <TouchableOpacity onPress={() => navigation.navigate('VendorApply')}>
            <Text style={{ color: '#f7ab18', fontWeight: '700' }}>Become a Vendor</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={{ color: '#f7ab18', fontWeight: '700' }}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fff' },
  logo: { width: 96, height: 96, marginBottom: 8, resizeMode: 'contain' },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#333' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, backgroundColor: '#f9f9f9', color: '#000' },
  btn: { width: '100%', backgroundColor: '#f7ab18', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
});

export default VendorAuth;