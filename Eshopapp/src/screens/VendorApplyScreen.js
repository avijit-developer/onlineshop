import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api, { API_BASE } from '../utils/api';

const VendorApplyScreen = ({ navigation }) => {
	const [form, setForm] = useState({
		name: '',
		companyName: '',
		email: '',
		phone: '',
		address1: '',
		address2: '',
		city: '',
		zip: '',
		address: '',
		useExistingVendorUser: false,
		vendorUserEmail: '',
		vendorUserName: '',
		vendorUserPassword: ''
	});
	const [submitting, setSubmitting] = useState(false);
  const [showPw, setShowPw] = useState(false);
	const [showPw, setShowPw] = useState(false);

	const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

	const submit = async () => {
		if (!form.companyName || !form.email || !form.phone) {
			Alert.alert('Validation', 'Company name, email and phone are required');
			return;
		}
		setSubmitting(true);
		try {
			const token = await api.getStoredToken?.();
			const res = await fetch(`${API_BASE}/api/v1/vendors/apply`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Public endpoint now; do not require token
				},
				body: JSON.stringify(form)
			});
			const json = await res.json();
			if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed');
			Alert.alert('Application Submitted', 'Your vendor application is submitted and pending approval.');
			navigation.goBack();
		} catch (e) {
			Alert.alert('Error', e?.message || 'Failed to submit application');
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
					<Icon name="arrow-back-outline" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.title}>Become a Vendor</Text>
				<View style={{ width: 24 }} />
			</View>
			<ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
				<Text style={styles.sectionSubtitle}>Tell us about your business</Text>
				<View style={styles.formGrid}>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Your Name</Text>
						<TextInput style={styles.input} value={form.name} onChangeText={v => update('name', v)} placeholder="John Doe" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Company Name *</Text>
						<TextInput style={styles.input} value={form.companyName} onChangeText={v => update('companyName', v)} placeholder="Acme Pvt Ltd" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Email *</Text>
						<TextInput style={styles.input} value={form.email} onChangeText={v => update('email', v)} placeholder="company@email.com" autoCapitalize="none" keyboardType="email-address" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Phone *</Text>
						<TextInput style={styles.input} value={form.phone} onChangeText={v => update('phone', v)} placeholder="+91 90000 00000" keyboardType="phone-pad" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Address Line 1</Text>
						<TextInput style={styles.input} value={form.address1} onChangeText={v => update('address1', v)} placeholder="Street, area" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Address Line 2</Text>
						<TextInput style={styles.input} value={form.address2} onChangeText={v => update('address2', v)} placeholder="Apartment, suite, etc." />
					</View>
					<View style={styles.formRow}>
						<View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}> 
							<Text style={styles.label}>City</Text>
							<TextInput style={styles.input} value={form.city} onChangeText={v => update('city', v)} placeholder="City" />
						</View>
						<View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}> 
							<Text style={styles.label}>ZIP / PIN</Text>
							<TextInput style={styles.input} value={form.zip} onChangeText={v => update('zip', v)} placeholder="PIN Code" keyboardType="numeric" />
						</View>
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Additional Address Info</Text>
						<TextInput style={styles.input} value={form.address} onChangeText={v => update('address', v)} placeholder="Landmark, notes" />
					</View>
					<Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>Vendor User Link</Text>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Use Existing Vendor User?</Text>
						<View style={{ flexDirection: 'row', gap: 12 }}>
							<TouchableOpacity onPress={() => update('useExistingVendorUser', true)} style={[styles.choice, form.useExistingVendorUser && styles.choiceActive]}>
								<Text style={[styles.choiceText, form.useExistingVendorUser && styles.choiceTextActive]}>YES</Text>
							</TouchableOpacity>
							<TouchableOpacity onPress={() => update('useExistingVendorUser', false)} style={[styles.choice, !form.useExistingVendorUser && styles.choiceActive]}>
								<Text style={[styles.choiceText, !form.useExistingVendorUser && styles.choiceTextActive]}>NO</Text>
							</TouchableOpacity>
						</View>
					</View>
					{form.useExistingVendorUser ? (
						<View style={styles.formGroup}>
							<Text style={styles.label}>Existing Vendor User Email *</Text>
							<TextInput style={styles.input} value={form.vendorUserEmail} onChangeText={v => update('vendorUserEmail', v)} placeholder="existing@vendor.com" autoCapitalize="none" keyboardType="email-address" />
						</View>
					) : (
						<>
							<View style={styles.formGroup}>
								<Text style={styles.label}>New Vendor User Name *</Text>
								<TextInput style={styles.input} value={form.vendorUserName} onChangeText={v => update('vendorUserName', v)} placeholder="Contact Person Name" />
							</View>
							<View style={styles.formGroup}>
								<Text style={styles.label}>New Vendor User Email *</Text>
								<TextInput style={styles.input} value={form.vendorUserEmail} onChangeText={v => update('vendorUserEmail', v)} placeholder="user@company.com" autoCapitalize="none" keyboardType="email-address" />
							</View>
							<View style={styles.formGroup}>
								<Text style={styles.label}>New Vendor User Password *</Text>
								<View style={{ position: 'relative' }}>
									<TextInput style={[styles.input, { paddingRight: 42, color: '#000' }]} value={form.vendorUserPassword} onChangeText={v => update('vendorUserPassword', v)} placeholder="Minimum 8 characters" placeholderTextColor="#777" secureTextEntry={!showPw} />
									<TouchableOpacity onPress={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, height: 40, top: '50%', marginTop: -20, justifyContent: 'center' }}>
										<Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
									</TouchableOpacity>
								</View>
							</View>
						</>
					)}
				</View>
				<TouchableOpacity style={[styles.submitButton, submitting && { opacity: 0.7 }]} onPress={submit} disabled={submitting}>
					<Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit Application'}</Text>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: '#fff' },
	header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fff' },
	title: { fontSize: 18, fontWeight: '600', color: '#333' },
	content: { paddingHorizontal: 16 },
	sectionSubtitle: { marginTop: 16, marginBottom: 8, fontSize: 13, color: '#666', fontWeight: '600' },
	formGrid: { marginTop: 4 },
	formGroup: { marginBottom: 12 },
	formRow: { flexDirection: 'row' },
	label: { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '600' },
	input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
	submitButton: { backgroundColor: '#f7ab18', marginTop: 20, marginBottom: 30, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
	submitText: { color: '#fff', fontWeight: '700' }
,
	choice: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
	choiceActive: { backgroundColor: '#fff9e6', borderColor: '#f7ab18' },
	choiceText: { color: '#666', fontWeight: '600' },
	choiceTextActive: { color: '#f7ab18' }
});

export default VendorApplyScreen;