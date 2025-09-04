import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';
import api from '../utils/api';

const OrderSuccessScreen = ({ route }) => {
  const navigation = useNavigation();
  const { orders, refreshOrders } = useUser();
  const { orderId } = route.params;
  
  const [order, setOrder] = React.useState(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        try { await refreshOrders(); } catch (_) {}
        const res = await api.getMyOrderById(orderId);
        if (mounted && res?.success) setOrder(res.data);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [orderId]);

  const handleContinueShopping = () => {
    navigation.navigate('Home');
  };

  const handleViewOrder = () => {
    navigation.navigate('OrderDetails', { orderId });
  };

  const handleTrackOrder = () => {
    // In a real app, this would navigate to order tracking
    navigation.navigate('OrderDetails', { orderId });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Icon name="checkmark-circle" size={80} color="#4CAF50" />
        </View>

        {/* Success Message */}
        <Text style={styles.title}>Order Placed Successfully!</Text>
        <Text style={styles.subtitle}>
          Thank you for your purchase. Your order has been confirmed and will be processed shortly.
        </Text>

        {/* Order Info */}
        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderTitle}>Order Details</Text>
            <Text style={styles.orderId}>#{orderId}</Text>
          </View>
          
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Order Date</Text>
            <Text style={styles.orderValue}>{order?.date || new Date().toISOString().split('T')[0]}</Text>
          </View>
          
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Total Amount</Text>
            <Text style={styles.orderValueBold}>₹{(order?.total != null ? Number(order.total).toFixed(2) : '0.00')}</Text>
          </View>
          
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Payment Method</Text>
            <Text style={styles.orderValue}>{order?.paymentMethod || 'Cash on Delivery'}</Text>
          </View>
          
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Estimated Delivery</Text>
            <Text style={styles.orderValue}>3-5 business days</Text>
          </View>
        </View>

        {/* What's Next */}
        <View style={styles.nextStepsCard}>
          <Text style={styles.nextStepsTitle}>What's Next?</Text>
          
          <View style={styles.stepItem}>
            <Icon name="mail-outline" size={20} color="#f7ab18" />
            <Text style={styles.stepText}>You'll receive an order confirmation email shortly</Text>
          </View>
          
          <View style={styles.stepItem}>
            <Icon name="cube-outline" size={20} color="#f7ab18" />
            <Text style={styles.stepText}>We'll notify you when your order ships</Text>
          </View>
          
          <View style={styles.stepItem}>
            <Icon name="location-outline" size={20} color="#f7ab18" />
            <Text style={styles.stepText}>Track your order anytime in the Orders section</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleViewOrder}>
            <Text style={styles.secondaryButtonText}>View Order</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.primaryButton} onPress={handleTrackOrder}>
            <Text style={styles.primaryButtonText}>Track Order</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Button */}
      <TouchableOpacity style={styles.continueButton} onPress={handleContinueShopping}>
        <Text style={styles.continueButtonText}>Continue Shopping</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  orderCard: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  orderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  orderId: {
    fontSize: 14,
    fontWeight: '500',
    color: '#f7ab18',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  orderValueBold: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  nextStepsCard: {
    width: '100%',
    backgroundColor: '#fff9e6',
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#f7ab18',
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#333',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default OrderSuccessScreen;