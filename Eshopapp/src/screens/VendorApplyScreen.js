import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
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
		// New: allow vendor to set credential during registration (optional when linking existing user)
		vendorUserPassword: '',
		confirmVendorUserPassword: '',
		// Bank details
		bankAccountHolderName: '',
		bankAccountNumber: '',
		bankName: '',
		bankIFSC: '',
		bankBranch: ''
	});
	const [submitting, setSubmitting] = useState(false);
	const [showPw, setShowPw] = useState(false);
	const [showPw2, setShowPw2] = useState(false);
	const [panCardFile, setPanCardFile] = useState(null);
	const [aadharCardFile, setAadharCardFile] = useState(null);
	const [bankDetailsDocumentFile, setBankDetailsDocumentFile] = useState(null);

	const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

	const getUploadSignature = async (subfolder, resourceType = 'auto') => {
		try {
			const token = await api.getStoredToken?.();
			const res = await fetch(`${API_BASE}/api/v1/uploads/signature`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { 'Authorization': `Bearer ${token}` } : {})
				},
				body: JSON.stringify({ folder: subfolder, resource_type: resourceType })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.message || 'Failed to get upload signature');
			return json.data;
		} catch (error) {
			throw new Error('Failed to get upload signature: ' + error.message);
		}
	};

	const uploadToCloudinary = async (file, subfolder = 'vendors') => {
		try {
			const isPDF = file.type === 'application/pdf' || (file.name && file.name.toLowerCase().endsWith('.pdf'));
			const resourceType = isPDF ? 'raw' : 'image';
			
			const { signature, timestamp, folder, apiKey, cloudName } = await getUploadSignature(subfolder, resourceType);
			
			const fd = new FormData();
			fd.append('file', {
				uri: file.uri,
				type: file.type || (isPDF ? 'application/pdf' : 'image/jpeg'),
				name: file.name || (isPDF ? 'document.pdf' : 'image.jpg')
			});
			fd.append('api_key', apiKey);
			fd.append('timestamp', String(timestamp));
			fd.append('signature', signature);
			fd.append('folder', folder);
			fd.append('unique_filename', 'true');
			fd.append('overwrite', 'false');
			fd.append('type', 'upload');
			// Note: resource_type is in the URL path, not in FormData
			
			const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
				method: 'POST',
				body: fd
			});
			
			const json = await res.json();
			
			if (!res.ok) {
				throw new Error(json?.error?.message || 'Cloudinary upload failed');
			}
			
			if (!json.secure_url) {
				throw new Error('Upload successful but URL not returned');
			}
			
			return { imageUrl: json.secure_url, imagePublicId: json.public_id };
		} catch (error) {
			throw error;
		}
	};

	const pickImage = async (type) => {
		try {
			// Allow both images and PDFs from gallery
			const result = await launchImageLibrary({ 
				mediaType: 'mixed', // This allows both images and videos, but we'll handle PDFs separately
				quality: 0.8,
				selectionLimit: 1
			});
			if (result?.assets && result.assets[0]) {
				const asset = result.assets[0];
				// Check if it's a PDF based on file name or type
				const isPDF = asset.fileName?.toLowerCase().endsWith('.pdf') || 
							  asset.type === 'application/pdf' ||
							  asset.uri?.toLowerCase().endsWith('.pdf');
				const file = {
					uri: asset.uri,
					type: isPDF ? 'application/pdf' : (asset.type || 'image/jpeg'),
					name: asset.fileName || (isPDF ? 'document.pdf' : 'image.jpg')
				};
				if (type === 'pan') {
					setPanCardFile(file);
				} else if (type === 'aadhar') {
					setAadharCardFile(file);
				} else if (type === 'bank') {
					setBankDetailsDocumentFile(file);
				}
			}
		} catch (error) {
			Alert.alert('Error', 'Failed to pick file');
		}
	};

	const submit = async () => {
		if (!form.companyName || !form.email || !form.phone) {
			Alert.alert('Validation', 'Company name, email and phone are required');
			return;
		}
		if (!form.bankAccountHolderName || !form.bankAccountNumber || !form.bankName || !form.bankIFSC || !form.bankBranch) {
			Alert.alert('Validation', 'Bank details are required (Account Holder Name, Account Number, Bank Name, IFSC Code, Branch)');
			return;
		}
		if (!panCardFile) {
			Alert.alert('Validation', 'PAN Card upload is required');
			return;
		}
		if (!aadharCardFile) {
			Alert.alert('Validation', 'Aadhar Card upload is required');
			return;
		}
		if (!bankDetailsDocumentFile) {
			Alert.alert('Validation', 'Bank Details Document upload is required');
			return;
		}
		// When creating a new vendor user, ensure password rules
		if (!form.useExistingVendorUser) {
			if (!form.vendorUserName || !form.vendorUserEmail) {
				Alert.alert('Validation', 'Vendor user name and email are required');
				return;
			}
			if (!form.vendorUserPassword || !form.confirmVendorUserPassword) {
				Alert.alert('Validation', 'Please enter password and confirm password');
				return;
			}
			if (form.vendorUserPassword.length < 6) {
				Alert.alert('Validation', 'Password should be at least 6 characters');
				return;
			}
			if (form.vendorUserPassword !== form.confirmVendorUserPassword) {
				Alert.alert('Validation', 'Passwords do not match');
				return;
			}
		}
		setSubmitting(true);
		try {
			// Upload documents first
			Alert.alert('Uploading', 'Please wait while we upload your documents...');
			
			const [panCardResult, aadharCardResult, bankDetailsResult] = await Promise.all([
				uploadToCloudinary(panCardFile, 'vendors/documents'),
				uploadToCloudinary(aadharCardFile, 'vendors/documents'),
				uploadToCloudinary(bankDetailsDocumentFile, 'vendors/documents')
			]);
			
			const token = await api.getStoredToken?.();
			const res = await fetch(`${API_BASE}/api/v1/vendors/apply`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					// Public endpoint now; do not require token
				},
				// Do not send confirm password to backend
				body: JSON.stringify({
					...form,
					confirmVendorUserPassword: undefined,
					panCard: panCardResult.imageUrl,
					panCardPublicId: panCardResult.imagePublicId,
					aadharCard: aadharCardResult.imageUrl,
					aadharCardPublicId: aadharCardResult.imagePublicId,
					bankDetailsDocument: bankDetailsResult.imageUrl,
					bankDetailsDocumentPublicId: bankDetailsResult.imagePublicId
				})
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
		<KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.select({ ios: 80, android: 0 })}>
			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
					<Icon name="arrow-back-outline" size={24} color="#333" />
				</TouchableOpacity>
				<Text style={styles.title}>Become a Vendor</Text>
				<View style={{ width: 24 }} />
			</View>
			<ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
				<Text style={styles.sectionSubtitle}>Tell us about your business</Text>
				<View style={styles.formGrid}>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Your Name</Text>
						<TextInput style={styles.input} value={form.name} onChangeText={v => update('name', v)} placeholder="John Doe" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Company Name <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.companyName} onChangeText={v => update('companyName', v)} placeholder="Acme Pvt Ltd" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Email <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.email} onChangeText={v => update('email', v)} placeholder="company@email.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Phone <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.phone} onChangeText={v => update('phone', v)} placeholder="+91 90000 00000" keyboardType="phone-pad" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Address Line 1</Text>
						<TextInput style={styles.input} value={form.address1} onChangeText={v => update('address1', v)} placeholder="Street, area" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Address Line 2</Text>
						<TextInput style={styles.input} value={form.address2} onChangeText={v => update('address2', v)} placeholder="Apartment, suite, etc." placeholderTextColor="#777" />
					</View>
					<View style={styles.formRow}>
						<View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}> 
							<Text style={styles.label}>City</Text>
							<TextInput style={styles.input} value={form.city} onChangeText={v => update('city', v)} placeholder="City" placeholderTextColor="#777" />
						</View>
						<View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}> 
							<Text style={styles.label}>ZIP / PIN</Text>
							<TextInput style={styles.input} value={form.zip} onChangeText={v => update('zip', v)} placeholder="PIN Code" keyboardType="numeric" placeholderTextColor="#777" />
						</View>
					</View>
					<View style={styles.formGroup}> 
						<Text style={styles.label}>Additional Address Info</Text>
						<TextInput style={styles.input} value={form.address} onChangeText={v => update('address', v)} placeholder="Landmark, notes" placeholderTextColor="#777" />
					</View>
					<Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>Bank Details <Text style={{ color: '#f7ab18' }}>*</Text></Text>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Account Holder Name <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.bankAccountHolderName} onChangeText={v => update('bankAccountHolderName', v)} placeholder="Account holder name" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Account Number <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.bankAccountNumber} onChangeText={v => update('bankAccountNumber', v)} placeholder="Bank account number" keyboardType="numeric" placeholderTextColor="#777" />
					</View>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Bank Name <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TextInput style={styles.input} value={form.bankName} onChangeText={v => update('bankName', v)} placeholder="Bank name" placeholderTextColor="#777" />
					</View>
					<View style={styles.formRow}>
						<View style={[styles.formGroup, { flex: 1, marginRight: 8 }]}>
							<Text style={styles.label}>IFSC Code <Text style={{ color: '#f7ab18' }}>*</Text></Text>
							<TextInput style={styles.input} value={form.bankIFSC} onChangeText={v => update('bankIFSC', v.toUpperCase())} placeholder="IFSC Code" autoCapitalize="characters" placeholderTextColor="#777" />
						</View>
						<View style={[styles.formGroup, { flex: 1, marginLeft: 8 }]}>
							<Text style={styles.label}>Branch <Text style={{ color: '#f7ab18' }}>*</Text></Text>
							<TextInput style={styles.input} value={form.bankBranch} onChangeText={v => update('bankBranch', v)} placeholder="Branch name" placeholderTextColor="#777" />
						</View>
					</View>
					<Text style={[styles.sectionSubtitle, { marginTop: 16 }]}>Documents <Text style={{ color: '#f7ab18' }}>*</Text></Text>
					<View style={styles.formGroup}>
						<Text style={styles.label}>PAN Card <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TouchableOpacity style={styles.fileButton} onPress={() => pickImage('pan')}>
							<Icon name="document-attach-outline" size={20} color="#f7ab18" />
							<Text style={styles.fileButtonText}>{panCardFile ? panCardFile.name || 'File selected' : 'Select PAN Card'}</Text>
						</TouchableOpacity>
						{panCardFile && panCardFile.type !== 'application/pdf' && (
							<Image source={{ uri: panCardFile.uri }} style={styles.previewImage} />
						)}
					</View>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Aadhar Card <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TouchableOpacity style={styles.fileButton} onPress={() => pickImage('aadhar')}>
							<Icon name="document-attach-outline" size={20} color="#f7ab18" />
							<Text style={styles.fileButtonText}>{aadharCardFile ? aadharCardFile.name || 'File selected' : 'Select Aadhar Card'}</Text>
						</TouchableOpacity>
						{aadharCardFile && aadharCardFile.type !== 'application/pdf' && (
							<Image source={{ uri: aadharCardFile.uri }} style={styles.previewImage} />
						)}
					</View>
					<View style={styles.formGroup}>
						<Text style={styles.label}>Bank Details Document <Text style={{ color: '#f7ab18' }}>*</Text></Text>
						<TouchableOpacity style={styles.fileButton} onPress={() => pickImage('bank')}>
							<Icon name="document-attach-outline" size={20} color="#f7ab18" />
							<Text style={styles.fileButtonText}>{bankDetailsDocumentFile ? bankDetailsDocumentFile.name || 'File selected' : 'Select Bank Details Document'}</Text>
						</TouchableOpacity>
						{bankDetailsDocumentFile && bankDetailsDocumentFile.type !== 'application/pdf' && (
							<Image source={{ uri: bankDetailsDocumentFile.uri }} style={styles.previewImage} />
						)}
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
							<Text style={styles.label}>Existing Vendor User Email <Text style={{ color: '#f7ab18' }}>*</Text></Text>
							<TextInput style={styles.input} value={form.vendorUserEmail} onChangeText={v => update('vendorUserEmail', v)} placeholder="existing@vendor.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#777" />
						</View>
					) : (
						<>
							<View style={styles.formGroup}>
								<Text style={styles.label}>New Vendor User Name <Text style={{ color: '#f7ab18' }}>*</Text></Text>
								<TextInput style={styles.input} value={form.vendorUserName} onChangeText={v => update('vendorUserName', v)} placeholder="Contact Person Name" placeholderTextColor="#777" />
							</View>
							<View style={styles.formGroup}>
								<Text style={styles.label}>New Vendor User Email <Text style={{ color: '#f7ab18' }}>*</Text></Text>
								<TextInput style={styles.input} value={form.vendorUserEmail} onChangeText={v => update('vendorUserEmail', v)} placeholder="user@company.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor="#777" />
							</View>
							<View style={styles.formGroup}>
								<Text style={styles.label}>Password <Text style={{ color: '#f7ab18' }}>*</Text></Text>
								<View style={{ position: 'relative' }}>
									<TextInput
										style={[styles.input, { paddingRight: 42 }]}
										value={form.vendorUserPassword}
										onChangeText={v => update('vendorUserPassword', v)}
										placeholder="Enter password"
										secureTextEntry={!showPw}
										autoCapitalize="none"
										placeholderTextColor="#777"
									/>
									<TouchableOpacity onPress={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, height: 40, top: '50%', marginTop: -20, justifyContent: 'center' }}>
										<Icon name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
									</TouchableOpacity>
								</View>
							</View>
							<View style={styles.formGroup}>
								<Text style={styles.label}>Confirm Password <Text style={{ color: '#f7ab18' }}>*</Text></Text>
								<View style={{ position: 'relative' }}>
									<TextInput
										style={[styles.input, { paddingRight: 42 }]}
										value={form.confirmVendorUserPassword}
										onChangeText={v => update('confirmVendorUserPassword', v)}
										placeholder="Re-enter password"
										secureTextEntry={!showPw2}
										autoCapitalize="none"
										placeholderTextColor="#777"
									/>
									<TouchableOpacity onPress={() => setShowPw2(v => !v)} style={{ position: 'absolute', right: 12, height: 40, top: '50%', marginTop: -20, justifyContent: 'center' }}>
										<Icon name={showPw2 ? 'eye-off-outline' : 'eye-outline'} size={20} color="#777" />
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
		</KeyboardAvoidingView>
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
		input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', color: '#000' },
	submitButton: { backgroundColor: '#f7ab18', marginTop: 20, marginBottom: 30, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
	submitText: { color: '#fff', fontWeight: '700' }
,
	choice: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#fff' },
	choiceActive: { backgroundColor: '#fff9e6', borderColor: '#f7ab18' },
	choiceText: { color: '#666', fontWeight: '600' },
	choiceTextActive: { color: '#f7ab18' },
	fileButton: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', gap: 8 },
	fileButtonText: { color: '#333', fontSize: 14, flex: 1 },
	previewImage: { marginTop: 8, width: '100%', height: 200, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' }
});

export default VendorApplyScreen;