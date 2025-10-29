import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../../utils/api';

const DriverProfile = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const changePassword = async () => {
    try {
      if (!currentPassword || !newPassword || !confirmPassword) { Alert.alert('Validation', 'All fields are required'); return; }
      if (newPassword !== confirmPassword) { Alert.alert('Validation', 'New passwords do not match'); return; }
      if (newPassword.length < 8) { Alert.alert('Validation', 'New password must be at least 8 characters'); return; }
      setSubmitting(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/auth/change-password`, { method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization: token ? `Bearer ${token}` : '' }, body: JSON.stringify({ currentPassword, newPassword }) });
      const j = await res.json().catch(()=>({}));
      if (!res.ok || !j?.success) throw new Error(j?.message || 'Failed to change password');
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) { Alert.alert('Error', e?.message || 'Failed to change password'); }
    finally { setSubmitting(false); }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('driverAuthToken');
    await AsyncStorage.removeItem('driverUser');
    Alert.alert('Logged out', 'You have been logged out.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.section}>Change Password</Text>
      <View style={styles.formGroup}><Text style={styles.label}>Current Password</Text><TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /></View>
      <View style={styles.formGroup}><Text style={styles.label}>New Password</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Confirm New Password</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry /></View>
      <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.7 }]} onPress={changePassword} disabled={submitting}><Text style={styles.btnText}>{submitting ? 'Updating...' : 'Update Password'}</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { backgroundColor:'#999', marginTop:12 }]} onPress={logout}><Text style={styles.btnText}>Logout</Text></TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({ container:{ flex:1, padding:16, backgroundColor:'#fff' }, title:{ fontSize:18, fontWeight:'700', marginBottom:8 }, section:{ marginTop:16, marginBottom:8, fontWeight:'600', color:'#555' }, formGroup:{ marginBottom:12 }, label:{ fontSize:12, color:'#666', marginBottom:6, fontWeight:'600' }, input:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' }, btn:{ backgroundColor:'#f7ab18', borderRadius:10, paddingVertical:12, alignItems:'center', marginTop:8 }, btnText:{ color:'#fff', fontWeight:'700' } });

export default DriverProfile;


