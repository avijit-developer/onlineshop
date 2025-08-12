import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';

const AddressListScreen = ({ route }) => {
  const navigation = useNavigation();
  const { addresses, deleteAddress, setDefaultAddress } = useUser();
  const isSelecting = route.params?.isSelecting || false;

  const handleAddAddress = () => {
    navigation.navigate('AddressDetails', { isNew: true });
  };

  const handleEditAddress = (address) => {
    navigation.navigate('AddressDetails', { address, isNew: false });
  };

  const handleDeleteAddress = (addressId, label) => {
    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete ${label} address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => deleteAddress(addressId) 
        }
      ]
    );
  };

  const handleSetDefault = (addressId) => {
    setDefaultAddress(addressId);
    Alert.alert('Success', 'Default address updated successfully');
  };

  const handleSelectAddress = (address) => {
    if (isSelecting) {
      // Return to previous screen with selected address
      navigation.goBack();
      // In a real app, you'd pass this back via navigation params or context
    }
  };

  const renderAddressItem = ({ item }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressLabelContainer}>
          <Icon name="location-outline" size={20} color="#f7ab18" />
          <Text style={styles.addressLabel}>{item.label}</Text>
          {item.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultText}>Default</Text>
            </View>
          )}
        </View>
        
        <View style={styles.addressActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEditAddress(item)}
          >
            <Icon name="create-outline" size={18} color="#f7ab18" />
          </TouchableOpacity>
          
          {!item.isDefault && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDeleteAddress(item.id, item.label)}
            >
              <Icon name="trash-outline" size={18} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.addressContent}>
        <Text style={styles.addressName}>{item.name}</Text>
        <Text style={styles.addressText}>
          {item.address}, {item.city}, {item.state} {item.zipCode}
        </Text>
        <Text style={styles.addressPhone}>{item.phone}</Text>
      </View>

      <View style={styles.addressFooter}>
        {!item.isDefault && (
          <TouchableOpacity
            style={styles.setDefaultButton}
            onPress={() => handleSetDefault(item.id)}
          >
            <Text style={styles.setDefaultText}>Set as Default</Text>
          </TouchableOpacity>
        )}
        
        {isSelecting && (
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => handleSelectAddress(item)}
          >
            <Text style={styles.selectButtonText}>Select</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyAddresses = () => (
    <View style={styles.emptyContainer}>
      <Icon name="location-outline" size={80} color="#ddd" />
      <Text style={styles.emptyTitle}>No addresses saved</Text>
      <Text style={styles.emptySubtitle}>Add your first delivery address</Text>
      <TouchableOpacity style={styles.addFirstButton} onPress={handleAddAddress}>
        <Text style={styles.addFirstButtonText}>Add Address</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {isSelecting ? 'Select Address' : 'My Addresses'}
        </Text>
        <TouchableOpacity onPress={handleAddAddress}>
          <Icon name="add-outline" size={24} color="#f7ab18" />
        </TouchableOpacity>
      </View>

      {addresses.length === 0 ? (
        renderEmptyAddresses()
      ) : (
        <>
          <FlatList
            data={addresses}
            renderItem={renderAddressItem}
            keyExtractor={(item) => item.id}
            style={styles.addressList}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          {/* Add New Address Button */}
          <TouchableOpacity style={styles.addButton} onPress={handleAddAddress}>
            <Icon name="add-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add New Address</Text>
          </TouchableOpacity>
        </>
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
  addressList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  addressCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addressLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  addressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  defaultBadge: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  defaultText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '500',
  },
  addressActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressContent: {
    marginBottom: 12,
  },
  addressName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  addressPhone: {
    fontSize: 14,
    color: '#666',
  },
  addressFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setDefaultButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  setDefaultText: {
    fontSize: 12,
    color: '#f7ab18',
    fontWeight: '500',
  },
  selectButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  selectButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#f7ab18',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
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