import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';
import { requestLocationAndGetAddress } from '../utils/locationUtils';

const AddressDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { addAddress, updateAddress } = useUser();
  const { address, isNew } = route.params;

  const [formData, setFormData] = useState({
    label: address?.label || '',
    name: address?.name || '',
    phone: address?.phone || '',
    address: address?.address || '',
    city: address?.city || '',
    state: address?.state || '',
    zipCode: address?.zipCode || '',
         country: address?.country || 'India',
  });

  const [errors, setErrors] = useState({});
  const [geoLoading, setGeoLoading] = useState(false);

  const addressLabels = ['Home', 'Work', 'Other'];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.label.trim()) newErrors.label = 'Please select an address label';
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.zipCode.trim()) newErrors.zipCode = 'Zip code is required';

    // Phone validation
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    // Zip code validation
    const zipRegex = /^\d{5}(-\d{4})?$/;
    if (formData.zipCode && !zipRegex.test(formData.zipCode)) {
      newErrors.zipCode = 'Please enter a valid zip code';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please fill in all required fields correctly');
      return;
    }

    try {
      if (isNew) {
        addAddress(formData);
        Alert.alert('Success', 'Address added successfully');
      } else {
        updateAddress(address.id, formData);
        Alert.alert('Success', 'Address updated successfully');
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', 'Failed to save address. Please try again.');
    }
  };

  const updateFormData = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const useCurrentLocation = async () => {
    try {
      setGeoLoading(true);
      const loc = await requestLocationAndGetAddress();
      if (!loc) return;
      // Attempt to split street/area and city/state if possible
      const parts = String(loc.address || '').split(',').map(s => s.trim());
      const guessedCity = loc.city || parts[parts.length - 2] || '';
      const guessedState = parts[parts.length - 1] || '';
      const street = parts.slice(0, Math.max(0, parts.length - 2)).join(', ');
      setFormData(prev => ({
        ...prev,
        address: street || prev.address,
        city: guessedCity || prev.city,
        state: guessedState || prev.state,
        zipCode: prev.zipCode,
        country: prev.country || 'India',
      }));
    } catch (e) {
      Alert.alert('Location Error', e?.message || 'Could not fetch your current location');
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>{isNew ? 'Add Address' : 'Edit Address'}</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Address Label Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Label</Text>
            <View style={styles.labelRow}>
              {addressLabels.map((label) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.labelChip, formData.label === label && styles.labelChipSelected]}
                  onPress={() => setFormData({ ...formData, label })}
                >
                  <Text style={[styles.labelChipText, formData.label === label && styles.labelChipTextSelected]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#777"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor="#777"
              keyboardType="phone-pad"
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
            />
          </View>

          {/* Address Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Address</Text>
            <TouchableOpacity style={styles.geoBtn} onPress={useCurrentLocation} disabled={geoLoading}>
              <Icon name="locate-outline" size={16} color="#fff" />
              <Text style={styles.geoBtnText}>{geoLoading ? 'Getting location...' : 'Use current location'}</Text>
            </TouchableOpacity>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Street address, house no., area"
              placeholderTextColor="#777"
              multiline
              numberOfLines={4}
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#777"
              value={formData.city}
              onChangeText={(text) => setFormData({ ...formData, city: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="State"
              placeholderTextColor="#777"
              value={formData.state}
              onChangeText={(text) => setFormData({ ...formData, state: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="PIN code"
              placeholderTextColor="#777"
              keyboardType="number-pad"
              value={formData.zipCode}
              onChangeText={(text) => setFormData({ ...formData, zipCode: text })}
            />
            <TextInput
              style={styles.input}
              placeholder="Country"
              placeholderTextColor="#777"
              value={formData.country}
              onChangeText={(text) => setFormData({ ...formData, country: text })}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Address</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveText: {
    fontSize: 16,
    color: '#f7ab18',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  labelContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedLabel: {
    backgroundColor: '#f7ab18',
    borderColor: '#f7ab18',
  },
  labelText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  selectedLabelText: {
    color: '#fff',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fafafa',
    marginBottom: 12,
    color: '#000',
  },
  textarea: {
    height: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    fontSize: 12,
    color: '#ff4444',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 30,
  },
  geoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: '#f7ab18', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 10 },
  geoBtnText: { color: '#fff', fontWeight: '700' },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  labelRow: {
    flexDirection: 'row',
    gap: 12,
  },
  labelChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  labelChipSelected: {
    backgroundColor: '#f7ab18',
    borderColor: '#f7ab18',
  },
  labelChipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  labelChipTextSelected: {
    color: '#fff',
  },
});

export default AddressDetailsScreen;