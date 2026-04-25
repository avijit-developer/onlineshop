import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../../utils/api';
import { createDriverSocket } from '../../utils/driverSocket';

const actionConfig = {
  assigned: { next: 'pickup_completed', label: 'Mark Pickup Completed' },
  pickup_completed: { next: 'on_the_way', label: 'Mark On The Way' },
  on_the_way: { next: 'delivered', label: 'Mark Delivered' },
};

const normalizeDriverStep = (value) => {
  const v = String(value || '').toLowerCase();
  if (v === 'delivery_completed') return 'delivered';
  if (['assigned', 'pickup_completed', 'on_the_way', 'delivered'].includes(v)) return v;
  return 'assigned';
};

const normalizePhoneNumber = (value) => String(value || '').replace(/[^\d+]/g, '');

const callPhoneNumber = async (phone) => {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    Alert.alert('Phone number not available');
    return;
  }

  const url = `tel:${normalized}`;
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to open dialer', normalized);
      return;
    }
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Unable to open dialer', error?.message || 'Please try again');
  }
};

const getTomorrowStart = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

const formatRescheduleDate = (date) => {
  if (!date) return 'Select a date';
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(date));
  } catch (_) {
    return new Date(date).toLocaleDateString();
  }
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateParts = (date) => {
  const normalized = normalizeDate(date) || new Date();
  return {
    year: normalized.getFullYear(),
    month: normalized.getMonth() + 1,
    day: normalized.getDate(),
  };
};

const fromDateParts = ({ year, month, day }) => {
  const date = normalizeDate(new Date(year, month - 1, day));
  if (!date) return null;
  return date;
};

const getTomorrowParts = () => getDateParts(getTomorrowStart());

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const getSelectableYears = () => {
  const tomorrow = getTomorrowParts();
  return Array.from({ length: 10 }, (_, i) => tomorrow.year + i);
};

const getSelectableMonths = (year) => {
  const tomorrow = getTomorrowParts();
  const minMonth = year === tomorrow.year ? tomorrow.month : 1;
  return Array.from({ length: 12 - minMonth + 1 }, (_, i) => minMonth + i);
};

const getSelectableDays = (year, month) => {
  const tomorrow = getTomorrowParts();
  const minDay = year === tomorrow.year && month === tomorrow.month ? tomorrow.day : 1;
  const maxDay = getDaysInMonth(year, month);
  return Array.from({ length: maxDay - minDay + 1 }, (_, i) => minDay + i);
};

const DriverOrderDetails = ({ navigation, route }) => {
  const initialOrder = route?.params?.order || null;
  const [order, setOrder] = useState(initialOrder);
  const [submitting, setSubmitting] = useState(false);
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState('tomorrow');
  const [rescheduleDate, setRescheduleDate] = useState(getTomorrowStart());
  const [draftRescheduleDate, setDraftRescheduleDate] = useState(getTomorrowStart());
  const rescheduleInFlight = useRef(false);

  const driverStatus = normalizeDriverStep(order?.driverStatus);
  const nextAction = actionConfig[driverStatus];

  const totalItems = useMemo(
    () => (order?.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    [order]
  );
  const customerPhone = order?.user?.phone || order?.customerPhone || '';

  useEffect(() => {
    let localSocket = null;
    let mounted = true;

    const handleOrderRemoved = (payload = {}) => {
      const nextOrder = payload?.order || {};
      const currentOrderId = String(order?._id || order?.id || '');
      const nextOrderId = String(nextOrder?._id || nextOrder?.id || '');
      if (!currentOrderId || currentOrderId !== nextOrderId) return;

      const nextDriverId = String(nextOrder?.driver?._id || nextOrder?.driver?.id || nextOrder?.driver || '');
      if (nextDriverId) return;

      if (rescheduleInFlight.current && payload?.action === 'reschedule') {
        return;
      }

      Alert.alert(
        'Order Removed',
        payload.message || 'This order has been removed from your driver list.',
        [
          {
            text: 'Back to Orders',
            onPress: () => {
              if (typeof navigation.popToTop === 'function') {
                navigation.popToTop();
                return;
              }
              navigation.goBack();
            },
          },
        ]
      );
    };

    (async () => {
      try {
        const token = await AsyncStorage.getItem('driverAuthToken');
        if (!mounted || !token) return;
        localSocket = createDriverSocket(token);
        if (!localSocket) return;
        localSocket.on('driver:order_unassigned', handleOrderRemoved);
        localSocket.on('order:updated', handleOrderRemoved);
      } catch (_) {}
    })();

    return () => {
      mounted = false;
      if (localSocket) {
        localSocket.off('driver:order_unassigned', handleOrderRemoved);
        localSocket.off('order:updated', handleOrderRemoved);
        localSocket.disconnect();
      }
    };
  }, [navigation, order?._id, order?.id]);

  const updateStatus = async (status, deliveryPaymentMethod = null) => {
    if (!order) return;
    try {
      setSubmitting(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver/${order._id || order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ status, deliveryPaymentMethod })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to update order');
      setOrder(json.data);
      Alert.alert('Success', 'Order status updated successfully');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to update order');
    } finally {
      setSubmitting(false);
      setShowPaymentModal(false);
    }
  };

  const openRescheduleModal = () => {
    const tomorrow = getTomorrowStart();
    setRescheduleMode('tomorrow');
    setDraftRescheduleDate(rescheduleDate || tomorrow);
    setShowRescheduleModal(true);
  };

  const clampRescheduleParts = (parts) => {
    const tomorrowParts = getTomorrowParts();
    const year = Math.max(Number(parts?.year) || tomorrowParts.year, tomorrowParts.year);
    const months = getSelectableMonths(year);
    const nextMonth = months.includes(Number(parts?.month)) ? Number(parts.month) : months[0];
    const days = getSelectableDays(year, nextMonth);
    const nextDay = days.includes(Number(parts?.day)) ? Number(parts.day) : days[0];
    return { year, month: nextMonth, day: nextDay };
  };

  const updateDraftRescheduleDate = (parts) => {
    const nextParts = clampRescheduleParts(parts);
    const nextDate = fromDateParts(nextParts);
    if (nextDate) {
      setDraftRescheduleDate(nextDate);
    }
  };

  const submitReschedule = async () => {
    if (!order) return;
    try {
      const tomorrowStart = getTomorrowStart();
      const payloadDate = normalizeDate(draftRescheduleDate || rescheduleDate);
      if (!payloadDate) {
        Alert.alert('Validation', 'Please enter a valid future date.');
        return;
      }
      if (payloadDate < tomorrowStart) {
        Alert.alert('Validation', 'Reschedule date must be tomorrow or later.');
        return;
      }
      setRescheduleDate(payloadDate);
      setRescheduleSubmitting(true);
      rescheduleInFlight.current = true;
      const token = await AsyncStorage.getItem('driverAuthToken');
      const res = await fetch(`${API_BASE}/api/v1/orders/driver/${order._id || order.id}/reschedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ rescheduleDate: payloadDate.toISOString() })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to reschedule order');
      setOrder(json.data || order);
      setShowRescheduleModal(false);
      Alert.alert('Success', 'Order rescheduled and removed from your list.', [
        {
          text: 'OK',
          onPress: () => {
            rescheduleInFlight.current = false;
            navigation.goBack();
          },
        },
      ]);
    } catch (error) {
      rescheduleInFlight.current = false;
      Alert.alert('Error', error?.message || 'Failed to reschedule order');
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const handlePrimaryAction = () => {
    if (!order || !nextAction) return;
    if (nextAction.next === 'delivered') {
      setShowPaymentModal(true);
      return;
    }
    updateStatus(nextAction.next);
  };

  if (!order) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Order details are unavailable.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Icon name="arrow-back-outline" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          <Text style={styles.status}>Driver Status: {driverStatus}</Text>
          <Text style={styles.meta}>Customer: {order.user?.name || order.user?.email || 'Customer'}</Text>
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => callPhoneNumber(customerPhone)}
            disabled={!customerPhone}
          >
            <Text style={[styles.meta, styles.phoneLink, !customerPhone && styles.phoneDisabled]}>
              Phone: {customerPhone || 'N/A'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.meta}>Payment: {order.paymentMethod || 'N/A'}</Text>
          <Text style={styles.meta}>Total Items: {totalItems}</Text>
          <Text style={styles.meta}>Order Amount: Rs {Number(order.total || 0).toFixed(2)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <Text style={styles.address}>{order.shippingAddress || 'No address available'}</Text>
          {(order.deliveryLatitude != null && order.deliveryLongitude != null) ? (
            <Text style={styles.coords}>Lat: {Number(order.deliveryLatitude).toFixed(6)} | Lng: {Number(order.deliveryLongitude).toFixed(6)}</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items || []).map((item, index) => (
            <View key={`${item.product || item.name}-${index}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
                {item.sku ? <Text style={styles.itemMeta}>SKU: {item.sku}</Text> : null}
              </View>
              <Text style={styles.itemPrice}>Rs {Number(item.price || 0).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {nextAction ? (
          <TouchableOpacity style={[styles.primaryButton, submitting && { opacity: 0.7 }]} onPress={handlePrimaryAction} disabled={submitting}>
            <Text style={styles.primaryText}>{submitting ? 'Updating...' : nextAction.label}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.doneBox}>
            <Text style={styles.doneText}>This order has completed all driver steps.</Text>
          </View>
        )}

        {nextAction ? (
          <TouchableOpacity
            style={[styles.rescheduleButton, (submitting || rescheduleSubmitting) && { opacity: 0.7 }]}
            onPress={openRescheduleModal}
            disabled={submitting || rescheduleSubmitting}
          >
            <Icon name="calendar-outline" size={18} color="#f7ab18" />
            <Text style={styles.rescheduleText}>Reschedule</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal
        visible={showPaymentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              disabled={submitting}
              onPress={() => {
                if (!submitting) setShowPaymentModal(false);
              }}
            >
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Payment Method</Text>
            <Text style={styles.modalSubtitle}>Choose one before completing delivery.</Text>

            <View style={styles.paymentRow}>
              <TouchableOpacity
                style={styles.paymentOption}
                disabled={submitting}
                onPress={() => updateStatus('delivered', 'cash')}
              >
                <Text style={styles.paymentOptionText}>Cash</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.paymentOption}
                disabled={submitting}
                onPress={() => updateStatus('delivered', 'online')}
              >
                <Text style={styles.paymentOptionText}>Online</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!rescheduleSubmitting) {
            setShowRescheduleModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              disabled={rescheduleSubmitting}
              onPress={() => {
                if (!rescheduleSubmitting) {
                  setShowRescheduleModal(false);
                }
              }}
            >
              <Text style={styles.modalCloseText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Reschedule Order</Text>
            <Text style={styles.modalSubtitle}>Choose tomorrow or pick a custom future date. This order will be removed from your list after saving.</Text>

            <View style={styles.rescheduleOptions}>
              <TouchableOpacity
                style={[styles.rescheduleOption, rescheduleMode === 'tomorrow' && styles.rescheduleOptionActive]}
                onPress={() => {
                  setRescheduleMode('tomorrow');
                  const tomorrow = getTomorrowStart();
                  setDraftRescheduleDate(tomorrow);
                }}
                disabled={rescheduleSubmitting}
              >
                <Text style={[styles.rescheduleOptionText, rescheduleMode === 'tomorrow' && styles.rescheduleOptionTextActive]}>Tomorrow</Text>
                <Text style={styles.rescheduleOptionHint}>{formatRescheduleDate(getTomorrowStart())}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.rescheduleOption, rescheduleMode === 'custom' && styles.rescheduleOptionActive]}
                onPress={() => {
                  setRescheduleMode('custom');
                }}
                disabled={rescheduleSubmitting}
              >
                <Text style={[styles.rescheduleOptionText, rescheduleMode === 'custom' && styles.rescheduleOptionTextActive]}>Custom Date</Text>
                <Text style={styles.rescheduleOptionHint}>{formatRescheduleDate(draftRescheduleDate)}</Text>
              </TouchableOpacity>
            </View>

            {rescheduleMode === 'custom' ? (
              <View style={styles.pickerWrap}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Select Custom Date</Text>
                  <TouchableOpacity onPress={() => setRescheduleMode('tomorrow')}>
                    <Icon name="close-outline" size={20} color="#111827" />
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerContainer}>
                  {[
                    {
                      label: 'Year',
                      values: getSelectableYears(),
                      getSelected: (parts) => parts.year,
                      setSelected: (parts, value) => clampRescheduleParts({ ...parts, year: value }),
                    },
                    {
                      label: 'Month',
                      values: getSelectableMonths(getDateParts(draftRescheduleDate).year),
                      getSelected: (parts) => parts.month,
                      setSelected: (parts, value) => clampRescheduleParts({ ...parts, month: value }),
                    },
                    {
                      label: 'Day',
                      values: getSelectableDays(getDateParts(draftRescheduleDate).year, getDateParts(draftRescheduleDate).month),
                      getSelected: (parts) => parts.day,
                      setSelected: (parts, value) => clampRescheduleParts({ ...parts, day: value }),
                    },
                  ].map((column) => {
                    const parts = getDateParts(draftRescheduleDate);
                    return (
                      <View key={column.label} style={styles.datePickerColumn}>
                        <Text style={styles.datePickerLabel}>{column.label}</Text>
                        <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                          {column.values.map((value) => {
                            const selected = column.getSelected(parts) === value;
                            return (
                              <TouchableOpacity
                                key={`${column.label}-${value}`}
                                style={[styles.datePickerOption, selected && styles.datePickerOptionActive]}
                                onPress={() => {
                                  const nextParts = column.setSelected(parts, value);
                                  updateDraftRescheduleDate(nextParts);
                                }}
                              >
                                <Text style={[styles.datePickerOptionText, selected && styles.datePickerOptionTextActive]}>
                                  {column.label === 'Month'
                                    ? new Date(2000, value - 1).toLocaleString('default', { month: 'short' })
                                    : value}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.rescheduleSummary}>
              <Text style={styles.rescheduleSummaryLabel}>Selected date</Text>
              <Text style={styles.rescheduleSummaryValue}>{formatRescheduleDate(draftRescheduleDate)}</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (submitting || rescheduleSubmitting) && { opacity: 0.7 }, { marginTop: 16 }]}
              disabled={submitting || rescheduleSubmitting}
              onPress={submitReschedule}
            >
              <Text style={styles.primaryText}>{rescheduleSubmitting ? 'Saving...' : 'Save Reschedule'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  emptyText: { color: '#64748b' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  iconButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  content: { padding: 16, paddingBottom: 28 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 16, marginBottom: 14, backgroundColor: '#fff' },
  orderNumber: { fontSize: 20, fontWeight: '800', color: '#111827' },
  status: { marginTop: 8, color: '#f59e0b', fontWeight: '700', textTransform: 'capitalize' },
  meta: { marginTop: 6, color: '#475569' },
  phoneLink: { color: '#2563eb', textDecorationLine: 'underline' },
  phoneDisabled: { color: '#475569', textDecorationLine: 'none' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 10 },
  address: { color: '#334155', lineHeight: 22 },
  coords: { marginTop: 8, color: '#64748b', fontSize: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  itemName: { fontWeight: '700', color: '#111827' },
  itemMeta: { color: '#64748b', marginTop: 4, fontSize: 12 },
  itemPrice: { fontWeight: '700', color: '#0f172a' },
  primaryButton: { backgroundColor: '#f7ab18', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  doneBox: { padding: 14, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  doneText: { textAlign: 'center', color: '#475569', fontWeight: '600' },
  rescheduleButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#f7ab18',
    backgroundColor: '#fff7e6',
    flexDirection: 'row',
    gap: 8,
  },
  rescheduleText: { color: '#f59e0b', fontWeight: '800', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    zIndex: 2,
  },
  modalCloseText: {
    fontSize: 22,
    lineHeight: 22,
    color: '#111827',
    fontWeight: '700',
    marginTop: -1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
    paddingRight: 40,
  },
  modalSubtitle: {
    marginTop: 6,
    color: '#64748b',
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  paymentOption: {
    flex: 1,
    backgroundColor: '#f7ab18',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  paymentOptionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  rescheduleOptions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rescheduleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#f8fafc',
  },
  rescheduleOptionActive: {
    borderColor: '#f7ab18',
    backgroundColor: '#fff7e6',
  },
  rescheduleOptionText: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 15,
  },
  rescheduleOptionTextActive: {
    color: '#b45309',
  },
  rescheduleOptionHint: {
    marginTop: 6,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  rescheduleSummary: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rescheduleSummaryLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rescheduleSummaryValue: {
    marginTop: 6,
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
  },
  pickerWrap: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff',
    padding: 12,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  datePickerContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  datePickerColumn: {
    flex: 1,
    minWidth: 0,
  },
  datePickerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  datePickerScroll: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
  },
  datePickerOption: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
    alignItems: 'center',
  },
  datePickerOptionActive: {
    backgroundColor: '#111827',
  },
  datePickerOptionText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 12,
  },
  datePickerOptionTextActive: {
    color: '#fff',
  },
});

export default DriverOrderDetails;
