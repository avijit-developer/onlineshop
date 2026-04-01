import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';
import { API_BASE } from '../../utils/api';

const DriverProfile = ({ navigation }) => {
  const [name, setName] = useState('');
  const [address1, setAddress1] = useState('');
  const [address2, setAddress2] = useState('');
  const [city, setCity] = useState('');
  const [zip, setZip] = useState('');
  const [address, setAddress] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [driverUser, setDriverUser] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem('driverUser');
        if (stored) {
          const parsed = JSON.parse(stored);
          setDriverUser(parsed);
        }
      } catch (_) {}

      try {
        const token = await AsyncStorage.getItem('driverAuthToken');
        const res = await fetch(`${API_BASE}/api/v1/drivers/me`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' }
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json?.success && json?.data) {
          const profile = json.data;
          setName(profile.name || '');
          setAddress1(profile.address1 || '');
          setAddress2(profile.address2 || '');
          setCity(profile.city || '');
          setZip(profile.zip || '');
          setAddress(profile.address || '');
          setDriverUser(prev => ({ ...(prev || {}), ...profile }));
        }
      } catch (_) {}
    })();
  }, []);

  const updateProfile = async () => {
    try {
      if (!name || !name.trim()) {
        Alert.alert('Validation', 'Name is required');
        return;
      }
      setProfileSubmitting(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/drivers/me/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          name,
          address1,
          address2,
          city,
          zip,
          address,
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update profile');

      const updated = { ...(driverUser || {}), ...(json.data || {}) };
      setDriverUser(updated);
      await AsyncStorage.setItem('driverUser', JSON.stringify(updated));
      Alert.alert('Success', 'Profile updated successfully');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

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
    const parent = navigation.getParent && navigation.getParent();
    const root = parent && parent.getParent ? parent.getParent() : null;
    const dispatcher = (root && root.dispatch) || (parent && parent.dispatch) || navigation.dispatch;
    dispatcher(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      })
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Profile</Text>
      <View style={styles.userCard}>
        <Text style={styles.userName}>{driverUser?.name || 'Driver'}</Text>
        {driverUser?.email ? <Text style={styles.userMeta}>{driverUser.email}</Text> : null}
        {driverUser?.phone ? <Text style={styles.userMeta}>{driverUser.phone}</Text> : null}
      </View>

      <Text style={styles.section}>Profile Details</Text>
      <View style={styles.formGroup}><Text style={styles.label}>Name</Text><TextInput style={styles.input} value={name} onChangeText={setName} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Address 1</Text><TextInput style={styles.input} value={address1} onChangeText={setAddress1} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Address 2</Text><TextInput style={styles.input} value={address2} onChangeText={setAddress2} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>City</Text><TextInput style={styles.input} value={city} onChangeText={setCity} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>ZIP / PIN</Text><TextInput style={styles.input} value={zip} onChangeText={setZip} /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Address / Notes</Text><TextInput style={[styles.input, styles.textArea]} value={address} onChangeText={setAddress} multiline /></View>
      <TouchableOpacity style={[styles.btn, profileSubmitting && { opacity: 0.7 }]} onPress={updateProfile} disabled={profileSubmitting}><Text style={styles.btnText}>{profileSubmitting ? 'Saving...' : 'Update Profile'}</Text></TouchableOpacity>

      <Text style={styles.section}>Change Password</Text>
      <View style={styles.formGroup}><Text style={styles.label}>Current Password</Text><TextInput style={styles.input} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry /></View>
      <View style={styles.formGroup}><Text style={styles.label}>New Password</Text><TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry /></View>
      <View style={styles.formGroup}><Text style={styles.label}>Confirm New Password</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry /></View>
      <TouchableOpacity style={[styles.btn, submitting && { opacity: 0.7 }]} onPress={changePassword} disabled={submitting}><Text style={styles.btnText}>{submitting ? 'Updating...' : 'Update Password'}</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { backgroundColor:'#999', marginTop:12 }]} onPress={logout}><Text style={styles.btnText}>Logout</Text></TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({ container:{ flex:1, backgroundColor:'#fff' }, content:{ padding:16, paddingBottom:28 }, title:{ fontSize:18, fontWeight:'700', marginBottom:8 }, userCard:{ padding:14, borderWidth:1, borderColor:'#e5e7eb', borderRadius:12, backgroundColor:'#f8fafc', marginTop:8 }, userName:{ fontWeight:'700', fontSize:16, color:'#111827' }, userMeta:{ marginTop:4, color:'#64748b' }, section:{ marginTop:16, marginBottom:8, fontWeight:'600', color:'#555' }, formGroup:{ marginBottom:12 }, label:{ fontSize:12, color:'#666', marginBottom:6, fontWeight:'600' }, input:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' }, textArea:{ minHeight:80, textAlignVertical:'top' }, btn:{ backgroundColor:'#f7ab18', borderRadius:10, paddingVertical:12, alignItems:'center', marginTop:8 }, btnText:{ color:'#fff', fontWeight:'700' } });

export default DriverProfile;


