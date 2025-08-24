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
  const { addresses, deleteAddress, setDefaultAddress } = useAddress();
  const { updateAddress: updateHeaderAddress } = useLocation();
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

  const handleSetDefault = (address) => {
    setDefaultAddress(address.id);
    Alert.alert('Default Address', 'Address set as default successfully!');
  };

  const handleSelectAddress = (address) => {
    if (isSelecting) {
      if (setDefaultOnSelect) {
        setDefaultAddress(address.id);
      }
      // Update header location immediately
      const line = `${address.address}, ${address.city}`;
      updateHeaderAddress(line);
      if (returnTo) {
        navigation.navigate(returnTo, { selectedAddress: address });
      } else {
        navigation.navigate('Checkout', { selectedAddress: address });
      }
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
          📧 {item.email} | 📱 {item.phone}
        </Text>
      </View>

      {/* Primary action */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => handleSelectAddress(item)}
      >
        <Text style={styles.primaryButtonText}>{isSelecting ? 'Deliver to this address' : (item.isDefault ? 'Default Address' : 'Deliver to this address')}</Text>
      </TouchableOpacity>

      {/* Inline actions */}
      <View style={styles.inlineActions}>
        {!item.isDefault && (
          <TouchableOpacity style={styles.inlineButton} onPress={() => handleSetDefault(item)}>
            <Text style={styles.inlineButtonText}>Set as Default</Text>
          </TouchableOpacity>
        )}
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
        <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
          <Icon name="add-outline" size={24} color="#f7ab18" />
        </TouchableOpacity>
      </View>

      {/* Address List */}
      {addresses.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={addresses}
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
});

export default AddressListScreen;