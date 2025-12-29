import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocation } from '../contexts/LocationContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';

export default function Header() {
  const navigation = useNavigation();
  const { address, area, city, postalCode, loadUserDefaultAddress } = useLocation();
  const { user } = useUser();

  // Reload address when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadUserDefaultAddress();
    }, [loadUserDefaultAddress])
  );

  const handleAddressPress = () => {
    navigation.navigate('AddressList', { isSelecting: true, setDefaultOnSelect: true, returnTo: 'Home' });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  // Get user avatar or use default
  const renderAvatar = () => {
    if (user?.avatar) {
      return <Image source={{ uri: user.avatar }} style={styles.avatar} />;
    }
    const name = user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    const [first, last] = (name || '').split(' ');
    const initials = `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || 'U';
    return (
      <View style={[styles.avatar, styles.avatarFallback]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
    );
  };

  // Format address for display - show only essential parts
  const getDisplayAddress = () => {
    if (!address || address === 'Select your location') {
      return 'Select your location';
    }
    
    // If we have both address and city, show "address, city"
    if (address && city) {
      return `${address}, ${city}`;
    }
    
    // If only address, show it (truncated if too long)
    if (address) {
      return address.length > 20 ? `${address.substring(0, 20)}...` : address;
    }
    
    // If only city, show it
    if (city) {
      return city;
    }
    
    return 'Select your location';
  };

  return (
    <View style={styles.container}>
      {/* Profile + My Activity */}
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.profileWrapper} onPress={handleProfilePress}>
          {renderAvatar()}
        </TouchableOpacity>
        <TouchableOpacity style={styles.addressWrapper} onPress={handleAddressPress}>
          <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
            {getDisplayAddress()}
          </Text>
          <Icon name="chevron-down-outline" size={12} color="#3F3F3F" style={styles.downIcon} />
        </TouchableOpacity>
      </View>

      {/* Icons */}
      <View style={styles.iconContainer}>
        <TouchableOpacity style={styles.iconWrapper} onPress={() => navigation.navigate('OrderList')}>
          <Icon name="receipt-outline" size={18} color="#3F3F3F" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f7ab18',
    marginTop:20,
    borderTopLeftRadius:10,
    borderTopRightRadius:10
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0, // Allow flex children to shrink below their content size
  },
  profileWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    // Remove elevation
    // Add subtle shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    // Add border for Android instead of elevation
    borderWidth: Platform.OS === 'android' ? 1.5 : 0,
    borderColor: '#ddd',
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#92400e',
    fontWeight: '800',
    fontSize: 14,
  },

  addressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flex: 1,
    maxWidth: '60%', // Reduced from 75% to make it more compact
    minWidth: 0, // Allow shrinking
  },
  addressText: {
    fontSize: 11, // Slightly smaller font
    color: '#3F3F3F',
    fontWeight: '500',
    flex: 1,
    minWidth: 0, // Allow text to shrink
    maxWidth: '100%', // Ensure text doesn't overflow container
  },
  downIcon: {
    marginLeft: 4,
    marginTop: 1,
    flexShrink: 0, // Prevent icon from shrinking
  },


  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0, // Prevent icon container from shrinking
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#004CFF',
  },
});
