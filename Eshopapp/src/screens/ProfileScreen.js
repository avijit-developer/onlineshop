import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';
import { useCart } from '../contexts/CartContext';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, orders, logout } = useUser();
  const { getCartItemsCount } = useCart();

  // Get user avatar or use default
  const getUserAvatar = () => {
    if (user?.avatar) {
      return { uri: user.avatar };
    }
    // Return a default avatar
    return { uri: 'https://i.pravatar.cc/100' };
  };

  // Get user display name
  const getUserDisplayName = () => {
    if (user?.name) {
      return user.name;
    }
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return 'User';
  };

  const profileOptions = [
    {
      id: 'orders',
      title: 'My Orders',
      subtitle: `${orders?.length || 0} orders`,
      icon: 'bag-outline',
      onPress: () => navigation.navigate('OrderList'),
    },
    {
      id: 'addresses',
      title: 'Addresses',
      subtitle: 'Manage delivery addresses',
      icon: 'location-outline',
      onPress: () => navigation.navigate('AddressList'),
    },
    {
      id: 'wishlist',
      title: 'Wishlist',
      subtitle: 'Your saved items',
      icon: 'heart-outline',
      onPress: () => navigation.navigate('Wishlist'),
    },
    {
      id: 'cart',
      title: 'Shopping Cart',
      subtitle: `${getCartItemsCount()} items`,
      icon: 'cart-outline',
      onPress: () => navigation.navigate('Cart'),
    },
    {
      id: 'payment',
      title: 'Payment Methods',
      subtitle: 'Manage payment options',
      icon: 'card-outline',
      onPress: () => Alert.alert('Coming Soon', 'Payment methods management will be available soon'),
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Manage your notifications',
      icon: 'notifications-outline',
      onPress: () => Alert.alert('Coming Soon', 'Notification settings will be available soon'),
    },
    {
      id: 'help',
      title: 'Help & Support',
      subtitle: 'Get help and contact us',
      icon: 'help-circle-outline',
      onPress: () => Alert.alert('Help & Support', 'Contact us at support@eshopapp.com'),
    },
    {
      id: 'about',
      title: 'About',
      subtitle: 'App version and info',
      icon: 'information-circle-outline',
      onPress: () => Alert.alert('About', 'EShop App v1.0.0\nBuilt with React Native'),
    },
  ];

  const handleEditProfile = () => {
    navigation.navigate('ProfileEdit');
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await logout();
            } catch {}
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }
      ]
    );
  };

  const renderProfileOption = (option) => (
    <TouchableOpacity
      key={option.id}
      style={styles.optionCard}
      onPress={option.onPress}
    >
      <View style={styles.optionIcon}>
        <Icon name={option.icon} size={24} color="#f7ab18" />
      </View>
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
      </View>
      <Icon name="chevron-forward-outline" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Icon name="create-outline" size={24} color="#f7ab18" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */}
        <View style={styles.profileCard}>
          <Image source={getUserAvatar()} style={styles.avatar} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{getUserDisplayName()}</Text>
            <Text style={styles.userEmail}>{user?.email || 'No email available'}</Text>
            <Text style={styles.userPhone}>{user?.phone || 'No phone available'}</Text>
            {user?.createdAt && (
              <Text style={styles.userMemberSince}>
                Member since {new Date(user.createdAt).getFullYear()}
              </Text>
            )}
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{orders?.length || 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{getCartItemsCount()}</Text>
            <Text style={styles.statLabel}>Cart Items</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Wishlist</Text>
          </View>
        </View>

        {/* Profile Options */}
        <View style={styles.optionsContainer}>
          {profileOptions.map(renderProfileOption)}
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Icon name="log-out-outline" size={20} color="#ff4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
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
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    marginTop: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  userPhone: {
    fontSize: 14,
    color: '#666',
  },
  userMemberSince: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  editButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f7ab18',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  optionsContainer: {
    marginTop: 30,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff9e6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff0f0',
    padding: 16,
    borderRadius: 12,
    marginTop: 30,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#ff4444',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff4444',
    marginLeft: 8,
  },
  backButton: {
    padding: 8,
  },
});

export default ProfileScreen;