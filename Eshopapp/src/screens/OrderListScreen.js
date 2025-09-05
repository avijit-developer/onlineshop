import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCart } from '../contexts/CartContext';
import { useUser } from '../contexts/UserContext';

const OrderListScreen = () => {
  const navigation = useNavigation();
  const { addToCart } = useCart();
  const { orders, refreshOrders } = useUser();
  const [selectedFilter, setSelectedFilter] = useState('all');

  React.useEffect(() => {
    refreshOrders();
  }, []);

  const orderFilters = [
    { id: 'all', label: 'All Orders' },
    { id: 'Confirmed', label: 'Confirmed' },
    { id: 'Processing', label: 'Processing' },
    { id: 'Shipped', label: 'Shipped' },
    { id: 'Delivered', label: 'Delivered' },
    { id: 'Cancelled', label: 'Cancelled' },
  ];

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

  const formatDate = (val) => {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const normalizeStatus = (s) => {
    const v = String(s || '').toLowerCase();
    if (['cancelled','canceled'].includes(v)) return 'Cancelled';
    if (['delivered','completed'].includes(v)) return 'Delivered';
    if (['shipped','out_for_delivery','out-for-delivery','dispatched','in_transit'].includes(v)) return 'Shipped';
    if (['confirmed'].includes(v)) return 'Confirmed';
    if (['processing','packed','pending'].includes(v)) return 'Processing';
    return 'Processing';
  };

  const aggregateMultiVendorStatus = (order) => {
    const summaries = Array.isArray(order?.vendorSummaries) ? order.vendorSummaries : [];
    if (summaries.length <= 1) return normalizeStatus(order?.status);
    const statuses = Array.from(new Set(summaries.map(vs => normalizeStatus(vs.status || order.status))));
    if (statuses.length === 1) return statuses[0];
    const precedence = ['Cancelled','Delivered','Shipped','Processing','Confirmed','Pending'];
    for (const st of precedence) {
      if (statuses.includes(st)) return `Partially ${st}`;
    }
    return 'Partially Processing';
  };

  // Expand multi-vendor orders into per-vendor rows for clarity
  const expandOrders = (src) => {
    const out = [];
    for (const o of (src || [])) {
      const summaries = Array.isArray(o.vendorSummaries) ? o.vendorSummaries : [];
      if (summaries.length > 1) {
        let idx = 0;
        for (const vs of summaries) {
          idx += 1;
          out.push({
            ...o,
            _id: `${o._id || o.id}-v${idx}`,
            items: vs.items || [],
            status: normalizeStatus(vs.status || o.status),
            packageLabel: `Package ${idx}`,
          });
        }
      } else {
        out.push(o);
      }
    }
    return out;
  };

  const filteredOrders = expandOrders(selectedFilter === 'all'
    ? orders
    : orders.filter(order => normalizeStatus(order.status) === selectedFilter));

  const renderOrderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => navigation.navigate('OrderDetails', { orderId: item._id || item.id })}
      activeOpacity={0.9}
    >
      {/* Header */}
      <View style={styles.orderHeader}>
        <Text style={styles.orderId}>#{item.orderNumber || (item._id || item.id)} {item.packageLabel ? `• ${item.packageLabel}` : ''}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Icon name={getStatusIcon(item.status)} size={12} color="#fff" />
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      {/* Aggregated status hint for multi-vendor orders */}
      {Array.isArray(item.vendorSummaries) && item.vendorSummaries.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 }}>
          <View style={{ backgroundColor: '#f5f5f5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ color: '#666', fontSize: 11 }}>{aggregateMultiVendorStatus(item)}</Text>
          </View>
        </View>
      )}

      {/* Meta row */}
      <View style={styles.metaRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="calendar-outline" size={14} color="#888" />
          <Text style={styles.orderDate}> {formatDate(item.createdAt)}</Text>
        </View>
        <Text style={styles.itemCount}>{item.items.length} item{item.items.length > 1 ? 's' : ''}</Text>
      </View>

      {/* Thumbnails */}
      <View style={styles.orderItems}>
        {item.items.slice(0, 4).map((orderItem, index) => (
          <Image
            key={index}
            source={{ uri: orderItem.image }}
            style={[styles.itemImage, index > 0 && { marginLeft: -10 }]}
          />
        ))}
        {item.items.length > 4 && (
          <View style={styles.moreItems}>
            <Text style={styles.moreItemsText}>+{item.items.length - 4}</Text>
          </View>
        )}
      </View>

      {/* Footer */}
      <View style={styles.cardDivider} />
      <View style={styles.footerRow}>
        <View style={{ flexDirection: 'column' }}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.orderTotal}>₹{Number(item.total || 0).toFixed(2)}</Text>
        </View>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.reorderPill}
            onPress={async (e) => {
              e.stopPropagation();
              try {
                for (const it of (item.items || [])) {
                  const productPayload = {
                    id: String(it.product || it._id || it.id),
                    _id: String(it.product || it._id || it.id),
                    name: it.name,
                    regularPrice: it.price,
                    specialPrice: undefined,
                    images: it.image ? [it.image] : [],
                    sku: it.sku,
                  };
                  await addToCart(productPayload, it.quantity || 1, it.selectedAttributes || null);
                }
                Alert.alert('Reorder', 'Items added to cart');
                navigation.navigate('Cart');
              } catch (e) {
                Alert.alert('Reorder', 'Failed to add some items');
              }
            }}
          >
            <Text style={styles.reorderPillText}>Reorder</Text>
          </TouchableOpacity>
          <Icon name="chevron-forward-outline" size={20} color="#999" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyOrders = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIllustration}>
        <Icon name="cart-outline" size={64} color="#f7ab18" />
      </View>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>Place your first order to see it here.</Text>
      <TouchableOpacity
        style={styles.shopButton}
        onPress={() => navigation.navigate('Home')}
      >
        <Text style={styles.shopButtonText}>Start Shopping</Text>
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
        <Text style={styles.title}>My Orders</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          data={orderFilters}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                selectedFilter === item.id && styles.activeFilterTab
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Text style={[
                styles.filterText,
                selectedFilter === item.id && styles.activeFilterText
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        renderEmptyOrders()
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderItem}
          keyExtractor={(item) => String(item._id || item.id)}
          style={styles.ordersList}
          contentContainerStyle={styles.ordersContent}
          showsVerticalScrollIndicator={false}
        />
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
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterList: {
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f5f5f5',
  },
  activeFilterTab: {
    backgroundColor: '#f7ab18',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeFilterText: {
    color: '#fff',
  },
  ordersList: {
    flex: 1,
  },
  ordersContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  orderCard: {
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
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: { fontSize: 15, fontWeight: '700', color: '#333' },
  orderDate: {
    fontSize: 12,
    color: '#666',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  orderItems: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  moreItems: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -10,
  },
  moreItemsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#666',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  itemCount: {
    fontSize: 14,
    color: '#666',
  },
  totalLabel: { fontSize: 11, color: '#888' },
  orderTotal: { fontSize: 16, fontWeight: '700', color: '#f7ab18' },
  cardDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  reorderPill: { backgroundColor: '#f7ab18', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14 },
  reorderPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIllustration: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#fff8e6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  shopButton: {
    backgroundColor: '#f7ab18',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default OrderListScreen;