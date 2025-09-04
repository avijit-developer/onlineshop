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
import { useWishlist } from '../contexts/WishlistContext';

const ProfileScreen = () => {
  const navigation = useNavigation();
  const { user, orders, logout } = useUser();
  const { getCartItemsCount } = useCart();
  const { getWishlistCount, wishlist } = useWishlist();

  // Render avatar or initials fallback
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
      icon: 'receipt-outline',
      onPress: () => navigation.navigate('OrderList'),
    },
    {
      id: 'addresses',
      title: 'Addresses',
      subtitle: 'Manage delivery addresses',
      icon: 'home-outline',
      onPress: () => navigation.navigate('AddressList'),
    },
    {
      id: 'wishlist',
      title: 'My Wishlist',
      subtitle: `${getWishlistCount()} saved items`,
      icon: 'heart',
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
      id: 'become-vendor',
      title: 'Become a Vendor',
      subtitle: 'Apply to open your shop',
      icon: 'briefcase-outline',
      onPress: () => navigation.navigate('VendorApply'),
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
      style={[
        styles.optionCard,
        option.id === 'wishlist' && styles.wishlistOptionCard
      ]}
      onPress={option.onPress}
    >
      <View style={[
        styles.optionIcon,
        option.id === 'wishlist' && styles.wishlistOptionIcon
      ]}>
        <Icon 
          name={option.icon} 
          size={24} 
          color={option.id === 'wishlist' ? '#e53935' : '#f7ab18'} 
        />
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
        <TouchableOpacity
          style={styles.editButton}
          onPress={handleEditProfile}
          accessibilityLabel="Edit profile"
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <View style={styles.editButtonContent}>
            <Icon name="create-outline" size={18} color="#fff" />
            <Text style={styles.editButtonLabel}>Edit</Text>
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info */
        }
        <View style={styles.profileCard}>
          {renderAvatar()}
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

        {/* Section: Quick Overview */}
        <Text style={styles.sectionTitle}>Quick Overview</Text>
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
            <Text style={styles.statNumber}>{getWishlistCount()}</Text>
            <Text style={styles.statLabel}>Wishlist</Text>
          </View>
        </View>

        {/* Recent Wishlist Items removed as requested */}

        {/* Section: Account */}
        <Text style={styles.sectionTitle}>Account</Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  avatarFallback: {
    backgroundColor: '#fde68a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#92400e',
    fontWeight: '800',
    fontSize: 20,
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
  editButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButtonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
  sectionTitle: {
    marginTop: 28,
    marginBottom: 10,
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  wishlistSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 10,
  },
  viewAllText: {
    fontSize: 14,
    color: '#f7ab18',
    fontWeight: '600',
  },
  wishlistScrollView: {
    marginTop: 10,
  },
  wishlistScrollContent: {
    paddingRight: 16,
  },
  wishlistItem: {
    width: 100,
    marginRight: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  wishlistItemImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 6,
  },
  wishlistItemName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
    lineHeight: 14,
  },
  wishlistItemPrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f7ab18',
  },
  wishlistOptionCard: {
    borderColor: '#e53935',
    borderWidth: 1,
    backgroundColor: '#fff5f5',
  },
  wishlistOptionIcon: {
    backgroundColor: '#ffe6e6',
  },
});

export default ProfileScreen;