import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocation } from '../contexts/LocationContext';

const AddressSelectionScreen = ({ navigation }) => {
  const { address, updateAddress, requestLocation, isLoading } = useLocation();
  const [customAddress, setCustomAddress] = useState('');
  const [selectedOption, setSelectedOption] = useState('current');

  const savedAddresses = [
    { id: '1', label: 'Home', address: '123 Main Street, City, State 12345' },
    { id: '2', label: 'Work', address: '456 Business Ave, Downtown, State 67890' },
    { id: '3', label: 'Other', address: '789 Park Road, Suburb, State 54321' },
  ];

  const handleUseCurrentLocation = async () => {
    setSelectedOption('current');
    await requestLocation();
  };

  const handleSelectSavedAddress = (savedAddress) => {
    setSelectedOption('saved');
    updateAddress(savedAddress.address);
  };

  const handleUseCustomAddress = () => {
    if (!customAddress.trim()) {
      Alert.alert('Error', 'Please enter a valid address');
      return;
    }
    setSelectedOption('custom');
    updateAddress(customAddress);
    navigation.goBack();
  };

  const handleConfirm = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Select Address</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Location */}
        <TouchableOpacity
          style={[
            styles.optionCard,
            selectedOption === 'current' && styles.selectedCard
          ]}
          onPress={handleUseCurrentLocation}
        >
          <View style={styles.optionHeader}>
            <Icon name="location-outline" size={20} color="#f7ab18" />
            <Text style={styles.optionTitle}>Use Current Location</Text>
            {isLoading && <ActivityIndicator size="small" color="#f7ab18" />}
          </View>
          <Text style={styles.optionSubtitle}>
            {address === 'Select your location' ? 'Tap to get your current location' : address}
          </Text>
        </TouchableOpacity>

        {/* Saved Addresses */}
        <Text style={styles.sectionTitle}>Saved Addresses</Text>
        {savedAddresses.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.optionCard,
              selectedOption === 'saved' && address === item.address && styles.selectedCard
            ]}
            onPress={() => handleSelectSavedAddress(item)}
          >
            <View style={styles.optionHeader}>
              <Icon name="home-outline" size={20} color="#f7ab18" />
              <Text style={styles.optionTitle}>{item.label}</Text>
            </View>
            <Text style={styles.optionSubtitle}>{item.address}</Text>
          </TouchableOpacity>
        ))}

        {/* Custom Address */}
        <Text style={styles.sectionTitle}>Enter Custom Address</Text>
        <View style={styles.customAddressCard}>
          <TextInput
            style={styles.input}
            placeholder="Enter your address"
            value={customAddress}
            onChangeText={setCustomAddress}
            multiline
          />
          <TouchableOpacity
            style={styles.useAddressButton}
            onPress={handleUseCustomAddress}
          >
            <Text style={styles.useAddressButtonText}>Use This Address</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirm Button */}
      {selectedOption !== 'custom' && (
        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>Confirm Address</Text>
        </TouchableOpacity>
      )}
    </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
  },
  optionCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: '#f7ab18',
    backgroundColor: '#fff9e6',
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  customAddressCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  useAddressButton: {
    backgroundColor: '#f7ab18',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  useAddressButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#f7ab18',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default AddressSelectionScreen;