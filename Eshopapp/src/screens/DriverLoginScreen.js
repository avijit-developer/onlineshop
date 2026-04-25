import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../utils/api';

const DriverLoginScreen = ({ navigation }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const login = async () => {
    if (!phone || !password) { Alert.alert('Validation', 'Phone and password are required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, password }) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to login');
      const role = json?.user?.role;
      if (role !== 'driver') { throw new Error('Please login with a driver account'); }
      await AsyncStorage.setItem('driverAuthToken', json.token);
      await AsyncStorage.setItem('driverUser', JSON.stringify(json.user));
      navigation.replace('DriverPortal');
    } catch (e) { Alert.alert('Login Failed', e?.message || 'Please try again'); }
    finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Icon name="arrow-back-outline" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.title}>Driver Login</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.form}>
        <View style={styles.formGroup}><Text style={styles.label}>Phone</Text><TextInput style={styles.input} autoCapitalize="none" keyboardType="phone-pad" placeholder="Enter phone number" placeholderTextColor="#94a3b8" value={phone} onChangeText={setPhone} /></View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              secureTextEntry={!showPassword}
              placeholder="Enter password"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword', { mode: 'driver' })} style={styles.forgotLink}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.7 }]} onPress={login} disabled={submitting}><Text style={styles.submitText}>{submitting ? 'Signing in...' : 'Sign In'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('DriverApply')} style={{ marginTop: 12, alignSelf:'center' }}><Text style={{ color:'#f7ab18', fontWeight:'600' }}>Become a Driver</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#fff' }, header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, paddingTop:20, borderBottomWidth:1, borderBottomColor:'#f0f0f0' }, backButton:{ padding:8 }, title:{ fontSize:18, fontWeight:'600', color:'#333' },
  form:{ padding:16 }, formGroup:{ marginBottom:12 }, label:{ fontSize:12, color:'#666', marginBottom:6, fontWeight:'600' }, input:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff', color:'#111827' },
  passwordWrapper:{ position:'relative', justifyContent:'center' }, passwordInput:{ paddingRight:42 }, eyeButton:{ position:'absolute', right:12, top:0, bottom:0, justifyContent:'center', alignItems:'center' },
  forgotLink:{ alignSelf:'flex-end', marginBottom:8 }, forgotText:{ color:'#f7ab18', fontWeight:'600' },
  submitButton:{ backgroundColor:'#f7ab18', marginTop:8, borderRadius:10, paddingVertical:14, alignItems:'center' }, submitText:{ color:'#fff', fontWeight:'700' }
});

export default DriverLoginScreen;


