import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../contexts/UserContext';
import api from '../utils/api';
import { useCart } from '../contexts/CartContext';

const OrderDetailsScreen = ({ route }) => {
  const navigation = useNavigation();
  const { orders } = useUser();
  const { addToCart } = useCart();
  const { orderId } = route.params;
  
  const order = orders.find(o => String(o._id || o.id) === String(orderId));
  const [freshOrder, setFreshOrder] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try { const res = await api.getMyOrderById(orderId); if (mounted && res?.success) setFreshOrder(res.data); } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [orderId]);

  if (!order) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="arrow-back-outline" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Order Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Order not found</Text>
        </View>
      </View>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Processing': return '#f7ab18';
      case 'Shipped': return '#2196F3';
      case 'Delivered': return '#4CAF50';
      case 'Cancelled': return '#ff4444';
      default: return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Processing': return 'hourglass-outline';
      case 'Shipped': return 'airplane-outline';
      case 'Delivered': return 'checkmark-circle-outline';
      case 'Cancelled': return 'close-circle-outline';
      default: return 'ellipse-outline';
    }
  };

  const handleReorder = () => {
    Alert.alert(
      'Reorder Items',
      'Add all items from this order to your cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add to Cart',
          onPress: () => {
            order.items.forEach(item => {
              addToCart({
                id: item.id,
                name: item.name,
                price: item.price,
                image: item.image,
              }, item.quantity, item.size, item.color);
            });
            Alert.alert('Success', 'Items added to cart!');
          }
        }
      ]
    );
  };

  const handleTrackOrder = () => {
    Alert.alert('Order Tracking', `Order ${orderId} is currently ${order.status.toLowerCase()}`);
  };

  const handleContactSupport = () => {
    Alert.alert('Contact Support', 'Email: support@eshopapp.com\nPhone: +1 800 123 4567');
  };

  const renderOrderItem = (item, index) => (
    <View key={index} style={styles.orderItem}>
      <Image source={{ uri: item.image }} style={styles.itemImage} />
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemVariant}>Size: {item.size} | Color: {item.color}</Text>
        <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>{item.price}</Text>
    </View>
  );

  const normalizeStatus = (s) => {
    const v = String(s || '').toLowerCase();
    if (['cancelled','canceled'].includes(v)) return 'Cancelled';
    if (['delivered','completed'].includes(v)) return 'Delivered';
    if (['shipped','out_for_delivery','out-for-delivery','dispatched','in_transit'].includes(v)) return 'Shipped';
    if (['confirmed'].includes(v)) return 'Confirmed';
    if (['processing','packed','pending'].includes(v)) return 'Processing';
    return 'Processing';
  };
  const current = freshOrder || order;
  const status = normalizeStatus(current.status);
  const intermediateLabel = status === 'Confirmed' ? 'Confirmed' : 'Processing';
  const orderProgress = [
    { step: 'Order Placed', completed: true, date: current.createdAt ? new Date(current.createdAt).toLocaleDateString() : '' },
    { step: intermediateLabel, completed: ['Confirmed','Processing','Shipped','Delivered'].includes(status), date: ['Confirmed','Processing'].includes(status) ? 'Current' : '' },
    { step: 'Shipped', completed: ['Shipped','Delivered'].includes(status), date: status === 'Shipped' ? 'Current' : '' },
    { step: 'Delivered', completed: status === 'Delivered', date: status === 'Delivered' ? 'Current' : '' },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-back-outline" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Order Details</Text>
        <TouchableOpacity onPress={handleContactSupport}>
          <Icon name="help-circle-outline" size={24} color="#f7ab18" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) }]}>
              <Icon name={getStatusIcon(status)} size={16} color="#fff" />
              <Text style={styles.statusText}>{status}</Text>
            </View>
            <Text style={styles.orderId}>#{current.orderNumber || (current._id || current.id)}</Text>
          </View>
          <Text style={styles.orderDate}>Placed on {current.createdAt ? new Date(current.createdAt).toLocaleDateString() : ''}</Text>
        </View>

        {/* Order Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Progress</Text>
          <View style={styles.progressContainer}>
            {orderProgress.map((step, index) => (
              <View key={index} style={styles.progressStep}>
                <View style={styles.progressLine}>
                  <View style={[
                    styles.progressDot,
                    step.completed && styles.completedDot
                  ]}>
                    {step.completed && (
                      <Icon name="checkmark" size={12} color="#fff" />
                    )}
                  </View>
                  {index < orderProgress.length - 1 && (
                    <View style={[
                      styles.progressConnector,
                      step.completed && styles.completedConnector
                    ]} />
                  )}
                </View>
                <View style={styles.progressContent}>
                  <Text style={[
                    styles.progressStepText,
                    step.completed && styles.completedStepText
                  ]}>
                    {step.step}
                  </Text>
                  {step.date && (
                    <Text style={styles.progressDate}>{step.date}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items ({current.items.length})</Text>
          {current.items.map((it, idx) => (
            <View key={idx} style={styles.orderItem}>
              <Image source={{ uri: it.image || '' }} style={styles.itemImage} />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={2}>{it.name || ''}</Text>
                <Text style={styles.itemVariant}>SKU: {it.sku || ''}</Text>
                <Text style={styles.itemQuantity}>Quantity: {it.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>₹{Number(it.price || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Shipping Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipping Address</Text>
          <View style={styles.addressCard}>
            <Icon name="location-outline" size={20} color="#f7ab18" />
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.addressText}>{current.shippingAddress}</Text>
              {!!(current?.customerPhone || current?.user?.phone) && (
                <Text style={[styles.addressText, { marginTop: 6, color: '#555' }]}>📱 {current?.customerPhone || current?.user?.phone}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.paymentCard}>
            <Icon name="card-outline" size={20} color="#f7ab18" />
            <Text style={styles.paymentText}>{current.paymentMethod}</Text>
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>₹{Number(current.subtotal || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Shipping</Text>
              <Text style={styles.summaryValue}>₹{Number(current.shippingCost || 0).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{Number(current.tax || 0)}%</Text>
            </View>
            {Number(current.discountAmount || 0) > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryValue}>- ₹{Number(current.discountAmount || 0).toFixed(2)}</Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>₹{Number(current.total || 0).toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.reorderButton} onPress={handleReorder}>
            <Icon name="refresh-outline" size={16} color="#f7ab18" />
            <Text style={styles.reorderButtonText}>Reorder</Text>
          </TouchableOpacity>
        </View>
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
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f7ab18',
  },
  orderDate: {
    fontSize: 14,
    color: '#666',
  },
  progressContainer: {
    paddingLeft: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  progressLine: {
    alignItems: 'center',
    marginRight: 16,
  },
  progressDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedDot: {
    backgroundColor: '#4CAF50',
  },
  progressConnector: {
    width: 2,
    height: 30,
    backgroundColor: '#ddd',
    marginTop: 4,
  },
  completedConnector: {
    backgroundColor: '#4CAF50',
  },
  progressContent: {
    flex: 1,
    paddingTop: 2,
  },
  progressStepText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  completedStepText: {
    color: '#333',
    fontWeight: '600',
  },
  progressDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  itemVariant: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
  },
  paymentText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    fontWeight: '500',
  },
  summaryCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#666',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f7ab18',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 30,
    marginBottom: 30,
  },
  trackButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f7ab18',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  reorderButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f7ab18',
  },
  reorderButtonText: {
    color: '#f7ab18',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundText: {
    fontSize: 18,
    color: '#666',
  },
});

export default OrderDetailsScreen;