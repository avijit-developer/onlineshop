import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE } from '../../utils/api';

const formatMoney = (value) => `₹${Number(value || 0).toFixed(2)}`;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateLabel = (date) => {
  const normalized = normalizeDate(date);
  if (!normalized) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(normalized);
};

const toStartOfDayIso = (date) => {
  const d = normalizeDate(date);
  if (!d) return '';
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const toEndOfDayIso = (date) => {
  const d = normalizeDate(date);
  if (!d) return '';
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

const getTodayParts = () => {
  const today = new Date();
  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
};

const getMaxSelectableMonth = (year) => {
  const { year: currentYear, month: currentMonth } = getTodayParts();
  return year === currentYear ? currentMonth : 12;
};

const getMaxSelectableDay = (year, month) => {
  const { year: currentYear, month: currentMonth, day: currentDay } = getTodayParts();
  if (year === currentYear && month === currentMonth) {
    return currentDay;
  }
  return getDaysInMonth(year, month);
};

const toDateParts = (date) => {
  const normalized = normalizeDate(date) || new Date();
  return {
    year: normalized.getFullYear(),
    month: normalized.getMonth() + 1,
    day: normalized.getDate(),
  };
};

const fromDateParts = ({ year, month, day }) => normalizeDate(new Date(year, month - 1, day));

const getStatusMeta = (order) => {
  const rawStatus = String(order?.status || '').toLowerCase();
  const driverStatus = String(order?.driverStatus || '').toLowerCase();
  const effective = rawStatus === 'delivered' || ['delivered', 'delivery_completed'].includes(driverStatus)
    ? 'delivered'
    : rawStatus === 'cancelled' || rawStatus === 'canceled'
      ? 'cancelled'
      : rawStatus === 'refunded'
        ? 'refunded'
        : rawStatus || driverStatus || 'delivered';

  switch (effective) {
    case 'delivered':
      return { key: 'delivered', label: 'Delivered', bg: '#dcfce7', color: '#166534' };
    case 'cancelled':
      return { key: 'cancelled', label: 'Cancelled', bg: '#fee2e2', color: '#991b1b' };
    case 'refunded':
      return { key: 'refunded', label: 'Refunded', bg: '#f3e8ff', color: '#6b21a8' };
    default:
      return { key: effective, label: String(effective || 'Delivered').replace(/_/g, ' '), bg: '#e5e7eb', color: '#374151' };
  }
};

const isDeliveredHistoryOrder = (order) => String(order?.driverStatus || '').toLowerCase() === 'delivered';

const DriverHistoryOrders = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDateModal, setShowDateModal] = useState(false);
  const [activeDatePicker, setActiveDatePicker] = useState(null);
  const [draftFromDate, setDraftFromDate] = useState(null);
  const [draftToDate, setDraftToDate] = useState(null);
  const [appliedFromDate, setAppliedFromDate] = useState(null);
  const [appliedToDate, setAppliedToDate] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const load = async ({ showLoading = true } = {}) => {
    try {
      if (showLoading) setLoading(true);
      const token = await AsyncStorage.getItem('driverAuthToken');
      const qs = new URLSearchParams();
      qs.append('mode', 'history');
      qs.append('page', String(page));
      qs.append('limit', String(limit));
      if (searchTerm.trim()) qs.append('q', searchTerm.trim());
      if (appliedFromDate) qs.append('from', toStartOfDayIso(appliedFromDate));
      if (appliedToDate) qs.append('to', toEndOfDayIso(appliedToDate));
      const res = await fetch(`${API_BASE}/api/v1/orders/driver?${qs.toString()}`, {
        headers: { Authorization: token ? `Bearer ${token}` : '' }
      });
      const json = await res.json();
      console.log(json.data)
      if (!res.ok || !json?.success) throw new Error(json?.message || 'Failed to load history');
      setOrders(Array.isArray(json.data) ? json.data.filter(isDeliveredHistoryOrder) : []);
      setTotal(Number(json?.meta?.total || 0));
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to load history orders');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, searchTerm, appliedFromDate, appliedToDate]);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await load({ showLoading: false });
    } finally {
      setRefreshing(false);
    }
  };

  const hasDateFilter = Boolean(appliedFromDate || appliedToDate);

  const dateRangeLabel = useMemo(() => {
    if (!appliedFromDate && !appliedToDate) return 'All dates';
    const from = appliedFromDate ? formatDateLabel(appliedFromDate) : 'Start';
    const to = appliedToDate ? formatDateLabel(appliedToDate) : 'Now';
    return `${from} - ${to}`;
  }, [appliedFromDate, appliedToDate]);

  const openDateModal = () => {
    setDraftFromDate(appliedFromDate ? new Date(appliedFromDate) : null);
    setDraftToDate(appliedToDate ? new Date(appliedToDate) : null);
    setActiveDatePicker(null);
    setShowDateModal(true);
  };

  const applyDateRange = () => {
    let from = draftFromDate ? new Date(draftFromDate) : null;
    let to = draftToDate ? new Date(draftToDate) : null;
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (from && from > today) from = new Date(today);
    if (to && to > today) to = new Date(today);

    if (from && to && to < from) {
      to = new Date(from);
    }

    setPage(1);
    setAppliedFromDate(from);
    setAppliedToDate(to);
    setShowDateModal(false);
  };

  const resetDateRange = () => {
    setPage(1);
    setDraftFromDate(null);
    setDraftToDate(null);
    setAppliedFromDate(null);
    setAppliedToDate(null);
    setActiveDatePicker(null);
    setShowDateModal(false);
  };

  const renderItem = ({ item }) => {
    const statusMeta = getStatusMeta(item);
    const createdLabel = formatDateLabel(item.createdAt);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DriverOrderDetails', { order: item, orderId: item._id || item.id })}
      >
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.orderNum}>#{item.orderNumber}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              {item.user?.name || item.user?.email || 'Customer'}
              {createdLabel ? ` · ${createdLabel}` : ''}
            </Text>
          </View>
          <Text style={[styles.badge, { backgroundColor: statusMeta.bg, color: statusMeta.color }]}>{statusMeta.label}</Text>
        </View>

        <View style={styles.infoBlock}>
          <Text style={styles.address} numberOfLines={1}>{item.shippingAddress}</Text>
        </View>

        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Order Value</Text>
            <Text style={styles.summaryValue}>{formatMoney(item.total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.summaryLabel}>Commission</Text>
            <Text style={styles.summaryValue}>{formatMoney(item.driverCommission)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const paginationFooter = orders.length > 0 ? (
    <View style={styles.paginationBlock}>
      <View style={styles.paginationRow}>
        <TouchableOpacity style={styles.pageBtn} onPress={() => setPage(1)} disabled={page === 1}>
          <Text style={[styles.pageBtnText, page === 1 && styles.pageBtnTextDisabled]}>First</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pageBtn} onPress={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
          <Text style={[styles.pageBtnText, page === 1 && styles.pageBtnTextDisabled]}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageInfo}>Page {page}</Text>
        <TouchableOpacity
          style={styles.pageBtn}
          onPress={() => setPage(p => p + 1)}
          disabled={orders.length < limit || page * limit >= total}
        >
          <Text style={[styles.pageBtnText, (orders.length < limit || page * limit >= total) && styles.pageBtnTextDisabled]}>Next</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.limitPill}>
        <TouchableOpacity onPress={() => { setLimit(10); setPage(1); }}>
          <Text style={[styles.limitText, limit === 10 && styles.limitTextActive]}>10</Text>
        </TouchableOpacity>
        <Text style={styles.limitDivider}>|</Text>
        <TouchableOpacity onPress={() => { setLimit(20); setPage(1); }}>
          <Text style={[styles.limitText, limit === 20 && styles.limitTextActive]}>20</Text>
        </TouchableOpacity>
        <Text style={styles.limitDivider}>|</Text>
        <TouchableOpacity onPress={() => { setLimit(50); setPage(1); }}>
          <Text style={[styles.limitText, limit === 50 && styles.limitTextActive]}>50</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <View style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        data={orders}
        keyExtractor={(i) => String(i._id || i.id)}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <View style={styles.toolbar}>
              <View style={styles.searchBox}>
                <Icon name="search-outline" size={18} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search order id"
                  placeholderTextColor="#94a3b8"
                  value={searchTerm}
                  onChangeText={(value) => {
                    setPage(1);
                    setSearchTerm(value);
                  }}
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity style={styles.filterButton} onPress={openDateModal} activeOpacity={0.9}>
                <Icon name="funnel-outline" size={18} color={hasDateFilter ? '#fff' : '#fff'} />
              </TouchableOpacity>
            </View>

            <View style={styles.rangeRow}>
              <View style={[styles.rangeChip, hasDateFilter && styles.rangeChipActive]}>
                <Icon name="calendar-outline" size={14} color={hasDateFilter ? '#fff' : '#64748b'} />
                <Text style={[styles.rangeChipText, hasDateFilter && styles.rangeChipTextActive]} numberOfLines={1}>
                  {dateRangeLabel}
                </Text>
              </View>
              {hasDateFilter && (
                <TouchableOpacity style={styles.resetTextBtn} onPress={resetDateRange}>
                  <Text style={styles.resetTextBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          orders.length === 0 ? styles.listContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f7ab18" colors={['#f7ab18']} />}
        ListFooterComponent={paginationFooter}
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#f7ab18" />
              <Text style={styles.loadingText}>Loading history orders...</Text>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No history orders found</Text>
              <Text style={styles.emptyText}>Closed delivery orders will appear here once they are completed.</Text>
            </View>
          )
        }
      />

      <Modal
        visible={showDateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Date Range</Text>
              <TouchableOpacity onPress={() => setShowDateModal(false)}>
                <Icon name="close-outline" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <TouchableOpacity
                style={styles.dateField}
                onPress={() => {
                  setActiveDatePicker(activeDatePicker === 'from' ? null : 'from');
                }}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.dateFieldLabel}>From</Text>
                  <Text style={[styles.dateFieldValue, !draftFromDate && styles.dateFieldPlaceholder]}>
                    {draftFromDate ? formatDateLabel(draftFromDate) : 'Choose start date'}
                  </Text>
                </View>
                <Icon name="calendar-outline" size={18} color="#64748b" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.dateField}
                onPress={() => {
                  setActiveDatePicker(activeDatePicker === 'to' ? null : 'to');
                }}
                activeOpacity={0.85}
              >
                <View>
                  <Text style={styles.dateFieldLabel}>To</Text>
                  <Text style={[styles.dateFieldValue, !draftToDate && styles.dateFieldPlaceholder]}>
                    {draftToDate ? formatDateLabel(draftToDate) : 'Choose end date'}
                  </Text>
                </View>
                <Icon name="calendar-outline" size={18} color="#64748b" />
              </TouchableOpacity>

              {activeDatePicker && (
                <View style={styles.pickerWrap}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      {activeDatePicker === 'from' ? 'Select From Date' : 'Select To Date'}
                    </Text>
                    <TouchableOpacity onPress={() => setActiveDatePicker(null)}>
                      <Icon name="close-outline" size={20} color="#111827" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.datePickerContainer}>
                    {[
                      {
                        label: 'Year',
                        values: Array.from({ length: 10 }, (_, i) => getTodayParts().year - i),
                        getSelected: (parts) => parts.year,
                        setSelected: (parts, value) => {
                          const maxMonth = getMaxSelectableMonth(value);
                          const month = Math.min(parts.month, maxMonth);
                          const day = Math.min(parts.day, getMaxSelectableDay(value, month));
                          return { ...parts, year: value, month, day };
                        },
                      },
                      {
                        label: 'Month',
                        values: Array.from({ length: getMaxSelectableMonth(toDateParts(activeDatePicker === 'from' ? draftFromDate : draftToDate || new Date()).year) }, (_, i) => i + 1),
                        getSelected: (parts) => parts.month,
                        setSelected: (parts, value) => {
                          const days = getMaxSelectableDay(parts.year, value);
                          return { ...parts, month: value, day: Math.min(parts.day, days) };
                        },
                      },
                      {
                        label: 'Day',
                        values: Array.from({
                          length: getMaxSelectableDay(
                            toDateParts(activeDatePicker === 'from' ? draftFromDate : draftToDate || draftFromDate || new Date()).year,
                            toDateParts(activeDatePicker === 'from' ? draftFromDate : draftToDate || draftFromDate || new Date()).month
                          )
                        }, (_, i) => i + 1),
                        getSelected: (parts) => parts.day,
                        setSelected: (parts, value) => ({ ...parts, day: value }),
                      },
                    ].map((column) => {
                      const currentDate = activeDatePicker === 'from' ? draftFromDate : draftToDate;
                      const parts = toDateParts(currentDate || draftFromDate || draftToDate || new Date());
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
                                    const nextDate = fromDateParts(nextParts);
                                    if (!nextDate) return;
                                    if (activeDatePicker === 'from') {
                                      setDraftFromDate(nextDate);
                                      if (draftToDate && nextDate > draftToDate) {
                                        setDraftToDate(nextDate);
                                      }
                                    } else {
                                      setDraftToDate(nextDate);
                                      if (draftFromDate && nextDate < draftFromDate) {
                                        setDraftFromDate(nextDate);
                                      }
                                    }
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
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetDateRange}>
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={applyDateRange}>
                <Text style={styles.primaryButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontWeight: '600',
    paddingVertical: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  rangeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  rangeChipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  rangeChipText: { color: '#475569', fontWeight: '700', fontSize: 12, flexShrink: 1 },
  rangeChipTextActive: { color: '#fff' },
  resetTextBtn: { paddingHorizontal: 4, paddingVertical: 6 },
  resetTextBtnText: { color: '#f7ab18', fontWeight: '800', fontSize: 12 },
  listContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 20 },
  listContentEmpty: { flexGrow: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748b', fontWeight: '600', marginTop: 10 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  emptyTitle: { color: '#111827', fontSize: 17, fontWeight: '800' },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 18, padding: 12, marginBottom: 10, backgroundColor: '#fff' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  cardMeta: { color: '#64748b', fontSize: 12, fontWeight: '600', marginTop: 3 },
  orderNum: { fontWeight: '900', fontSize: 17, color: '#111827' },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, overflow: 'hidden', fontWeight: '800', fontSize: 11 },
  infoBlock: { marginTop: 8 },
  address: { color: '#475569', lineHeight: 18, fontSize: 13 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  summaryLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { color: '#111827', fontWeight: '900', fontSize: 14, marginTop: 2 },
  paginationBlock: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 2,
    marginBottom: 8,
  },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  pageBtnText: { color: '#111827', fontWeight: '800' },
  pageBtnTextDisabled: { color: '#94a3b8' },
  pageInfo: { color: '#334155', fontWeight: '700' },
  limitPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, justifyContent: 'center' },
  limitText: { color: '#64748b', fontWeight: '700' },
  limitTextActive: { color: '#f7ab18' },
  limitDivider: { color: '#cbd5e1' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#111827',
  },
  modalBody: {
    gap: 12,
  },
  pickerWrap: {
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
  dateField: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
  },
  dateFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateFieldValue: {
    marginTop: 4,
    color: '#111827',
    fontWeight: '700',
    fontSize: 15,
  },
  dateFieldPlaceholder: {
    color: '#64748b',
    fontWeight: '600',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#eef2f7',
  },
  secondaryButtonText: {
    color: '#111827',
    fontWeight: '800',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#f7ab18',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '900',
  },
});

export default DriverHistoryOrders;
