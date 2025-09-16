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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.title}>Vendor Login</Text>
          <Text style={styles.subtitle}>Sign in to manage your orders</Text>
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#777" value={email} onChangeText={setEmail} autoCapitalize="none" />
          <View style={{ position: 'relative' }}>
            <TextInput style={[styles.input, { paddingRight: 42 }]} placeholder="Password" placeholderTextColor="#777" value={password} onChangeText={setPassword} secureTextEntry={!showPw} autoCapitalize="none" selectionColor="#333" cursorColor="#333" />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, height: 48, top: '45%', marginTop: -24, justifyContent: 'center' }}>
              <Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.btn} onPress={loginVendor} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
          <View style={styles.linksRow}>
            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', { mode: 'vendor' })}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('VendorApply')}>
              <Text style={styles.linkText}>Become a Vendor</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: '#f7ab18', fontWeight: '700' }}>{'< Back to Customer Login'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#fff', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 24 },
  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 15, backgroundColor: '#f9f9f9', color: '#000' },
  btn: { backgroundColor: '#f7ab18', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linksRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  linkText: { color: '#f7ab18', fontSize: 14, fontWeight: '600' },
});

export default VendorAuth;