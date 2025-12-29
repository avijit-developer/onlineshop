import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAddress } from '../contexts/AddressContext';
import { requestLocationAndGetAddress } from '../utils/locationUtils';
import MapPicker from './MapPicker';

const AddressForm = ({ address, onSave, onCancel }) => {
  const { addAddress, updateAddress } = useAddress();
  const isEditing = !!address;

  const [formData, setFormData] = useState({
    label: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'India',
    isDefault: false,
    latitude: null,
    longitude: null,
  });
  const [geoLoading, setGeoLoading] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    if (address) {
      setFormData({
        label: address.label || '',
        firstName: address.firstName || '',
        lastName: address.lastName || '',
        phone: address.phone || '',
        address: address.address || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.zipCode || '',
        country: address.country || 'India',
        isDefault: !!address.isDefault,
        latitude: address.location?.coordinates?.[1] || address.latitude || null,
        longitude: address.location?.coordinates?.[0] || address.longitude || null,
      });
    }
  }, [address]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    const requiredFields = ['firstName', 'lastName', 'phone', 'address', 'city', 'state', 'zipCode'];
    
    for (const field of requiredFields) {
      if (!formData[field] || formData[field].trim() === '') {
        Alert.alert('Validation Error', `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }

    // Phone validation (10 digits)
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(formData.phone)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit phone number');
      return false;
    }

    // ZIP code validation (6 digits)
    const zipRegex = /^[0-9]{6}$/;
    if (!zipRegex.test(formData.zipCode)) {
      Alert.alert('Validation Error', 'Please enter a valid 6-digit ZIP code');
      return false;
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      if (isEditing) {
        await updateAddress(address.id, formData);
        Alert.alert('Success', 'Address updated successfully!');
      } else {
        await addAddress(formData);
        Alert.alert('Success', 'Address added successfully!');
      }
      onSave(formData);
    } catch (error) {
      Alert.alert('Error', 'Failed to save address. Please try again.');
    }
  };

  const fillFromCurrentLocation = async () => {
    try {
      setGeoLoading(true);
      const loc = await requestLocationAndGetAddress();
      if (!loc) return;
      const parts = String(loc.address || '').split(',').map(s => s.trim());
      const guessedCity = loc.city || parts[parts.length - 2] || '';
      const guessedState = loc.state || parts[parts.length - 1] || '';
      const street = parts.slice(0, Math.max(0, parts.length - 2)).join(', ');
      setFormData(prev => ({
        ...prev,
        address: street || prev.address,
        city: guessedCity || prev.city,
        state: guessedState || prev.state,
        zipCode: loc.postalCode || prev.zipCode,
        country: loc.country || prev.country || 'India',
      }));
    } catch (e) {
      Alert.alert('Location Error', e?.message || 'Could not fetch your current location');
    } finally {
      setGeoLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {isEditing ? 'Edit Address' : 'Add New Address'}
        </Text>
        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Address Label */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address Label (Optional)</Text>
          <TextInput
            style={styles.textInput}
            value={formData.label}
            onChangeText={(value) => handleInputChange('label', value)}
            placeholder="e.g., Home, Office, Mom's House"
            autoCapitalize="words"
          />
          <View style={styles.chipsRow}>
            {['Home', 'Work', 'Other'].map(type => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, formData.label?.toLowerCase() === type.toLowerCase() && styles.chipActive]}
                onPress={() => handleInputChange('label', type)}
              >
                <Text style={[styles.chipText, formData.label?.toLowerCase() === type.toLowerCase() && styles.chipTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>First Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder="Enter first name"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Last Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder="Enter last name"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Phone *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder="Enter phone number"
                keyboardType="phone-pad"
                maxLength={10}
              />
            </View>
            <View style={styles.halfInput} />
          </View>
        </View>

        {/* Address Information */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
            <Text style={[styles.sectionTitle, { flex: 1, marginRight: 8 }]}>Address Information</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <TouchableOpacity style={styles.mapBtn} onPress={() => setShowMapPicker(true)}>
                <Icon name="map-outline" size={14} color="#fff" />
                <Text style={styles.geoBtnText}>Select on Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.geoBtn} onPress={fillFromCurrentLocation} disabled={geoLoading}>
                <Icon name="locate-outline" size={14} color="#fff" />
                <Text style={styles.geoBtnText}>{geoLoading ? 'Getting…' : 'Current Location'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.hintText}>
            {formData.latitude && formData.longitude 
              ? `📍 Location selected: ${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}`
              : 'Tip: Select location on map for accurate delivery area validation'}
          </Text>
          
          <Text style={styles.inputLabel}>Full Address *</Text>
          <TextInput
            style={[styles.textInput, styles.fullWidthInput]}
            value={formData.address}
            onChangeText={(value) => handleInputChange('address', value)}
            placeholder="Enter your complete address"
            multiline
            numberOfLines={3}
          />

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>City *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.city}
                onChangeText={(value) => handleInputChange('city', value)}
                placeholder="Enter city"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>State *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.state}
                onChangeText={(value) => handleInputChange('state', value)}
                placeholder="Enter state"
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.formRow}>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>ZIP Code *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.zipCode}
                onChangeText={(value) => handleInputChange('zipCode', value)}
                placeholder="Enter ZIP code"
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
            <View style={styles.halfInput}>
              <Text style={styles.inputLabel}>Country</Text>
              <TextInput
                style={styles.textInput}
                value={formData.country}
                onChangeText={(value) => handleInputChange('country', value)}
                placeholder="Enter country"
                autoCapitalize="words"
              />
            </View>
          </View>
        </View>

        {/* Default Toggle */}
        <View style={styles.section}>
          <View style={styles.defaultRow}>
            <TouchableOpacity
              onPress={() => handleInputChange('isDefault', !formData.isDefault)}
              style={[styles.checkbox, formData.isDefault && styles.checkboxChecked]}
            >
              {formData.isDefault && <Icon name="checkmark" size={16} color="#fff" />}
            </TouchableOpacity>
            <Text style={styles.defaultText}>Set as default address</Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveAddressButton} onPress={handleSave}>
          <Icon name="checkmark-circle-outline" size={20} color="#fff" />
          <Text style={styles.saveAddressButtonText}>
            {isEditing ? 'Update Address' : 'Save Address'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Map Picker Modal */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <MapPicker
          initialLocation={
            formData.latitude && formData.longitude
              ? { latitude: formData.latitude, longitude: formData.longitude }
              : null
          }
          onSelectLocation={(location) => {
            setFormData(prev => ({
              ...prev,
              latitude: location.latitude,
              longitude: location.longitude,
            }));
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  cancelButton: {
    padding: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  saveButton: {
    padding: 8,
  },
  saveText: {
    fontSize: 16,
    color: '#f7ab18',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  chipActive: {
    borderColor: '#f7ab18',
    backgroundColor: '#fff9e6',
  },
  chipText: {
    color: '#333',
    fontSize: 12,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#f7ab18',
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfInput: {
    flex: 0.48,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  fullWidthInput: {
    marginBottom: 16,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  saveAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  saveAddressButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#4caf50',
    borderColor: '#4caf50',
  },
  defaultText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  geoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f7ab18', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#4caf50', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6 },
  geoBtnText: { color: '#fff', fontWeight: '700', marginLeft: 4, fontSize: 12 },
  hintText: { color: '#6b7280', fontSize: 12, marginTop: 6 },
});

export default AddressForm;