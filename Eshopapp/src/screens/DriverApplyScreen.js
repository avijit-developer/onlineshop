import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api, { API_BASE } from '../utils/api';

const DriverApplyScreen = ({ navigation }) => {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address1: '', address2: '', city: '', zip: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.email || !form.phone) { Alert.alert('Validation', 'Name, email and phone are required'); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/drivers/apply`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json().catch(()=>({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to submit');
      Alert.alert('Application Submitted', 'Your driver application is submitted and pending approval.');
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e?.message || 'Failed to submit application'); }
    finally { setSubmitting(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Icon name="arrow-back-outline" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.title}>Become a Driver</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionSubtitle}>Tell us about you</Text>
        <View style={styles.formGroup}><Text style={styles.label}>Name *</Text><TextInput style={styles.input} value={form.name} onChangeText={v => update('name', v)} placeholder="John Doe" /></View>
        <View style={styles.formGroup}><Text style={styles.label}>Email *</Text><TextInput style={styles.input} value={form.email} onChangeText={v => update('email', v)} autoCapitalize="none" keyboardType="email-address" placeholder="driver@email.com" /></View>
        <View style={styles.formGroup}><Text style={styles.label}>Phone *</Text><TextInput style={styles.input} value={form.phone} onChangeText={v => update('phone', v)} keyboardType="phone-pad" placeholder="+91 90000 00000" /></View>
        <View style={styles.formGroup}><Text style={styles.label}>Address Line 1</Text><TextInput style={styles.input} value={form.address1} onChangeText={v => update('address1', v)} placeholder="Street" /></View>
        <View style={styles.formRow}>
          <View style={[styles.formGroup, { flex:1, marginRight:8 }]}><Text style={styles.label}>City</Text><TextInput style={styles.input} value={form.city} onChangeText={v => update('city', v)} placeholder="City" /></View>
          <View style={[styles.formGroup, { flex:1, marginLeft:8 }]}><Text style={styles.label}>ZIP</Text><TextInput style={styles.input} value={form.zip} onChangeText={v => update('zip', v)} keyboardType="numeric" placeholder="PIN" /></View>
        </View>
        <TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}><Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Application'}</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#fff' }, header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:12, paddingTop:20, borderBottomWidth:1, borderBottomColor:'#f0f0f0' },
  backButton:{ padding:8 }, title:{ fontSize:18, fontWeight:'600', color:'#333' }, content:{ paddingHorizontal:16 }, sectionSubtitle:{ marginTop:16, marginBottom:8, fontSize:13, color:'#666', fontWeight:'600' },
  formGroup:{ marginBottom:12 }, formRow:{ flexDirection:'row' }, label:{ fontSize:12, color:'#666', marginBottom:6, fontWeight:'600' }, input:{ borderWidth:1, borderColor:'#e5e7eb', borderRadius:8, paddingHorizontal:12, paddingVertical:10, backgroundColor:'#fff' },
  submitButton:{ backgroundColor:'#f7ab18', marginTop:20, marginBottom:30, borderRadius:10, paddingVertical:14, alignItems:'center' }, submitText:{ color:'#fff', fontWeight:'700' }
});

export default DriverApplyScreen;


