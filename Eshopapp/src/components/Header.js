import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useLocation } from '../contexts/LocationContext';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';

export default function Header() {
  const navigation = useNavigation();
  const { address } = useLocation();
  const { user } = useUser();

  const handleAddressPress = () => {
    navigation.navigate('AddressList', { isSelecting: true, setDefaultOnSelect: true, returnTo: 'Home' });
  };

  const handleProfilePress = () => {
    navigation.navigate('Profile');
  };

  // Get user avatar or use default
  const getUserAvatar = () => {
    if (user?.avatar) {
      return { uri: user.avatar };
    }
    // Return a default avatar or user initials
    return { uri: 'https://i.pravatar.cc/100' };
  };

  return (
    <View style={styles.container}>
      {/* Profile + My Activity */}
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.profileWrapper} onPress={handleProfilePress}>
          <Image
            source={getUserAvatar()}
            style={styles.avatar}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.addressWrapper} onPress={handleAddressPress}>
          <Text style={styles.addressText} numberOfLines={1}>
            {address || 'Select your location'}
          </Text>
          <Icon name="chevron-down-outline" size={14} color="#3F3F3F" style={styles.downIcon} />
        </TouchableOpacity>
      </View>

      {/* Icons */}
      <View style={styles.iconContainer}>
        {/* <TouchableOpacity style={styles.iconWrapper}>
          <Icon name="reader-outline" size={18} color="#3F3F3F" />
        </TouchableOpacity> */}
        <TouchableOpacity style={styles.iconWrapper}>
          <View>
            <Icon name="list-outline" size={18} color="#3F3F3F" />
            <View style={styles.dot} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconWrapper}>
          <Icon name="settings-outline" size={18} color="#3F3F3F" />
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

  addressWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flex: 1,
    maxWidth: 200,
  },
  addressText: {
    fontSize: 12,
    color: '#3F3F3F',
    fontWeight: '500',
    flex: 1,
  },
  downIcon: {
    marginLeft: 4,
    marginTop: 1,
  },


  iconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
