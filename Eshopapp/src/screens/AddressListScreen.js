import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useAddress } from '../contexts/AddressContext';
import { useLocation } from '../contexts/LocationContext';
import AddressForm from '../components/AddressForm';

const AddressListScreen = ({ route }) => {
  const navigation = useNavigation();
  const { addresses, deleteAddress, setDefaultAddress, syncLocalAddresses, forceRefreshFromAPI } = useAddress();
  const { updateAddress: updateHeaderAddress, loadUserDefaultAddress } = useLocation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const isSelecting = route.params?.isSelecting || false;
  const setDefaultOnSelect = route.params?.setDefaultOnSelect || false;
  const returnTo = route.params?.returnTo || null;

  const handleAddAddress = () => {
    setShowAddModal(true);
  };

  const handleEditAddress = (address) => {
    setEditingAddress(address);
    setShowEditModal(true);
  };

  const handleDeleteAddress = (address) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete this address?\n\n${address.address}, ${address.city}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteAddress(address.id)
        }
      ]
    );
  };

  const handleSetDefault = async (address) => {
    // Check if this is a local address
    if (!address._originalId) {
      Alert.alert(
        'Local Address',
        'This address is stored locally and cannot be set as default until it\'s synced with the server. Would you like to refresh your addresses from the server?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Refresh Now', onPress: async () => {
            try {
              await forceRefreshFromAPI();
              Alert.alert('Success', 'Addresses refreshed from server. You can now try setting the default address again.');
            } catch (error) {
              Alert.alert('Error', 'Failed to refresh addresses. Please try again.');
            }
          }}
        ]
      );
      return;
    }

    try {
      await setDefaultAddress(address.id);
      Alert.alert('Default Address', 'Address set as default successfully!');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to set address as default. Please try again.');
    }
  };

  const handleSelectAddress = async (address) => {
    if (isSelecting) {
      try {
        // Check if this address can be set as default (must have _originalId from API)
        if (!address.isDefault && !address._originalId) {
          Alert.alert(
            'Local Address',
            'This address is stored locally and cannot be set as default. Please refresh your addresses from the server first.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Refresh Now', onPress: async () => {
                try {
                  await forceRefreshFromAPI();
                  Alert.alert('Success', 'Addresses refreshed from server. You can now try delivering to this address again.');
                } catch (error) {
                  Alert.alert('Error', 'Failed to refresh addresses. Please try again.');
                }
              }}
            ]
          );
          return;
        }
        
        // Set the selected address as default when delivering (only if not already default)
        if (!address.isDefault) {
          try {
            await setDefaultAddress(address.id);
            
            // Update the home page header immediately after setting default
            const line = `${address.address}, ${address.city}`;
            updateHeaderAddress(line);
            
          } catch (defaultError) {
            console.log('Failed to set address as default:', defaultError);
            // Ask user if they want to proceed without setting as default
            Alert.alert(
              'Set Default Failed',
              'Failed to set this address as default. Would you like to proceed with delivery anyway?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Proceed Anyway', onPress: () => {
                  // Continue with delivery without setting as default
                  const line = `${address.address}, ${address.city}`;
                  updateHeaderAddress(line);
                  loadUserDefaultAddress();
                  
                  if (returnTo) {
                    navigation.goBack();
                  } else {
                    navigation.navigate('Checkout', { selectedAddress: address });
                  }
                }}
              ]
            );
            return;
          }
        } else {
          // Address is already default, just update header
          const line = `${address.address}, ${address.city}`;
          updateHeaderAddress(line);
        }
        
        // Also refresh default from server in case
        loadUserDefaultAddress();
        
        if (returnTo) {
          navigation.goBack();
        } else {
          navigation.navigate('Checkout', { selectedAddress: address });
        }
      } catch (error) {
        console.log('Error in handleSelectAddress:', error);
        Alert.alert('Error', error.message || 'Failed to set address as default. Please try again.');
      }
    }
  };

  const handleSync = async () => {
    try {
      await forceRefreshFromAPI();
      Alert.alert('Sync Complete', 'Addresses have been synced with the server.');
    } catch (error) {
      Alert.alert('Sync Failed', 'Failed to sync addresses. Please try again.');
    }
  };

  const renderAddressItem = ({ item }) => (
    <View
      style={[styles.addressCard, item.isDefault && styles.defaultAddressCard]}
    >
      <View style={styles.addressHeader}>
        <View style={styles.addressInfo}>
          <Text style={styles.addressLabel}>
            {item.label || `${item.firstName} ${item.lastName}`}
          </Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
          {!item._originalId && (
            <View style={styles.localBadge}>
              <Text style={styles.localText}>Local</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.addressContent}>
        <Text style={styles.addressText}>
          {item.firstName} {item.lastName}
        </Text>
        <Text style={styles.addressText}>
          {item.address}
        </Text>
        <Text style={styles.addressText}>
          {item.city}, {item.state} {item.zipCode}
        </Text>
        <Text style={styles.addressText}>
          {item.country}
        </Text>
        <Text style={styles.contactText}>
          📱 {item.phone}
        </Text>
      </View>

      {/* Primary action */}
      {item.isDefault ? (
        <View style={[styles.primaryButton, styles.defaultButton]}>
          <Text style={[styles.primaryButtonText, styles.defaultButtonText]}>Default Address</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => handleSelectAddress(item)}
        >
          <Text style={styles.primaryButtonText}>Deliver to this address</Text>
        </TouchableOpacity>
      )}

      {/* Inline actions */}
      <View style={styles.inlineActions}>
        <TouchableOpacity style={styles.inlineButton} onPress={() => handleEditAddress(item)}>
          <Text style={styles.inlineButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.inlineButtonDanger} onPress={() => handleDeleteAddress(item)}>
          <Text style={styles.inlineButtonDangerText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Icon name="location-outline" size={80} color="#ddd" />
      <Text style={styles.emptyTitle}>No addresses yet</Text>
      <Text style={styles.emptySubtitle}>Add your first shipping address to get started</Text>
      <TouchableOpacity style={styles.addFirstButton} onPress={handleAddAddress}>
        <Text style={styles.addFirstButtonText}>Add Address</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isSelecting ? 'Select Address' : 'My Addresses'}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
            <Icon name="sync-outline" size={24} color="#666" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
            <Icon name="add-outline" size={24} color="#f7ab18" />
          </TouchableOpacity>
        </View>
      </View>

      

      {/* Address List */}
      {addresses.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={addresses.sort((a, b) => {
            // Sort default address to the top
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            // If both have same default status, maintain original order
            return 0;
          })}
          renderItem={renderAddressItem}
          keyExtractor={(item) => item.id}
          style={styles.addressList}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.addressListContent}
        />
      )}

      {/* Add Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <AddressForm
          onSave={(address) => {
            setShowAddModal(false);
            // Address will be saved by AddressForm
          }}
          onCancel={() => setShowAddModal(false)}
        />
      </Modal>

      {/* Edit Address Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <AddressForm
          address={editingAddress}
          onSave={(updatedAddress) => {
            setShowEditModal(false);
            setEditingAddress(null);
            // Address will be updated by AddressForm
          }}
          onCancel={() => {
            setShowEditModal(false);
            setEditingAddress(null);
          }}
        />
      </Modal>
    </View>
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
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  syncButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  addressList: {
    flex: 1,
  },
  addressListContent: {
    padding: 16,
  },
  addressCard: {
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
  defaultAddressCard: {
    borderWidth: 2,
    borderColor: '#f7ab18',
    backgroundColor: '#fff8e1',
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  defaultBadge: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  defaultText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  localBadge: {
    backgroundColor: '#4CAF50', // A green color for local addresses
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  localText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  addressActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  addressContent: {
    marginBottom: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  setDefaultButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
  },
  setDefaultText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  primaryButton: {
    backgroundColor: '#f7ab18',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  inlineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  inlineButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  inlineButtonText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '500',
  },
  inlineButtonDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  inlineButtonDangerText: {
    color: '#ff4444',
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: '#e0e0e0',
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  addFirstButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  addFirstButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  defaultButton: {
    backgroundColor: '#e0e0e0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  defaultButtonText: {
    color: '#999', // Changed color for disabled default button
  },
});

export default AddressListScreen;