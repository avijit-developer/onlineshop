import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, ScrollView, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../../utils/api';

const VendorOrders = ({ navigation }) => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });
  const [tempDateTo, setTempDateTo] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() });

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getVendorOrders({ page: 1, limit: 100 });
        if (res?.success) setOrders(res.data || []);
      } catch (_) {}
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter, dateFrom, dateTo]);

  const filterOrders = () => {
    let filtered = orders;

    // Search filter - only by Order ID
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(order => {
        const orderNum = String(order.orderNumber || order._id || '').toLowerCase();
        return orderNum.includes(q);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => {
        const status = String(order.status || '').toLowerCase();
        const filterStatus = statusFilter.toLowerCase();
        if (filterStatus === 'delivered' || filterStatus === 'completed') {
          return status === 'delivered' || status === 'completed';
        }
        return status === filterStatus;
      });
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00`);
      filtered = filtered.filter(order => {
        if (!order.createdAt) return false;
        const created = new Date(order.createdAt);
        return created >= from;
      });
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59.999`);
      filtered = filtered.filter(order => {
        if (!order.createdAt) return false;
        const created = new Date(order.createdAt);
        return created <= to;
      });
    }

    setFilteredOrders(filtered);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const formatDateForInput = (dateObj) => {
    if (!dateObj || !dateObj.year) return '';
    const year = String(dateObj.year);
    const month = String(dateObj.month).padStart(2, '0');
    const day = String(dateObj.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseDate = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10)
    };
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const handleDateFromConfirm = () => {
    console.log('Confirming date from:', tempDateFrom);
    const formattedDate = formatDateForInput(tempDateFrom);
    console.log('Formatted date:', formattedDate);
    setDateFrom(formattedDate);
    setShowDateFromPicker(false);
    console.log('Date from set to:', formattedDate);
  };

  const handleDateToConfirm = () => {
    console.log('Confirming date to:', tempDateTo);
    const formattedDate = formatDateForInput(tempDateTo);
    console.log('Formatted date:', formattedDate);
    setDateTo(formattedDate);
    setShowDateToPicker(false);
    console.log('Date to set to:', formattedDate);
  };

  const handleDateFromOpen = () => {
    console.log('Opening date from picker');
    const parsed = parseDate(dateFrom);
    if (parsed) {
      setTempDateFrom(parsed);
    } else {
      // Initialize with today's date if no date is set
      const today = new Date();
      setTempDateFrom({
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate()
      });
    }
    setShowDateFromPicker(true);
    console.log('Date from picker state set to true');
  };

  const handleDateToOpen = () => {
    console.log('Opening date to picker');
    const parsed = parseDate(dateTo);
    if (parsed) {
      setTempDateTo(parsed);
    } else {
      // Initialize with today's date if no date is set
      const today = new Date();
      setTempDateTo({
        year: today.getFullYear(),
        month: today.getMonth() + 1,
        day: today.getDate()
      });
    }
    setShowDateToPicker(true);
    console.log('Date to picker state set to true');
  };

  const getStatusBadgeStyle = (status) => {
    const s = String(status || '').toLowerCase();
    if (['delivered', 'completed'].includes(s)) return styles.statusDelivered;
    if (['shipped', 'out_for_delivery', 'dispatched'].includes(s)) return styles.statusShipped;
    if (['processing', 'packed'].includes(s)) return styles.statusProcessing;
    if (['confirmed'].includes(s)) return styles.statusConfirmed;
    if (['cancelled', 'canceled'].includes(s)) return styles.statusCancelled;
    return styles.statusPending;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('VendorOrderDetails', { orderId: item._id || item.id, order: item })}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.orderId}>#{item.orderNumber || item._id?.slice(-6)}</Text>
        <View style={[styles.statusBadge, getStatusBadgeStyle(item.status)]}>
          <Text style={styles.statusText}>{String(item.status || 'Pending')}</Text>
        </View>
      </View>
      <Text style={styles.customerName}>
        {item.user?.name || item.customerName || item.user?.email || 'Customer'}
      </Text>
      <Text style={styles.amount}>Total: ₹{Number(item.vendorSubtotal || 0).toFixed(2)}</Text>
      {item.createdAt && (
        <Text style={styles.date}>
          {new Date(item.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendor Orders</Text>
        <TouchableOpacity onPress={() => setFiltersOpen(!filtersOpen)}>
          <Icon name={filtersOpen ? "filter" : "filter-outline"} size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search-outline" size={20} color="#8791a1" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by Order ID..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#8791a1"
        />
        {searchTerm.length > 0 && (
          <TouchableOpacity onPress={() => setSearchTerm('')} style={styles.clearButton}>
            <Icon name="close-circle" size={20} color="#8791a1" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters Panel */}
      {filtersOpen && (
        <View style={styles.filtersPanel}>
          <ScrollView nestedScrollEnabled>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>Status</Text>
              <TouchableOpacity 
                style={styles.filterSelect}
                onPress={() => setShowStatusModal(true)}
              >
                <Text style={styles.filterSelectText}>
                  {statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                </Text>
                <Icon name="chevron-down" size={16} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>From Date</Text>
              <TouchableOpacity 
                style={styles.dateInput}
                onPress={handleDateFromOpen}
              >
                <Text style={[styles.dateInputText, !dateFrom && styles.dateInputPlaceholder]}>
                  {dateFrom || 'Select date'}
                </Text>
                <Icon name="calendar-outline" size={20} color="#8791a1" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>To Date</Text>
              <TouchableOpacity 
                style={styles.dateInput}
                onPress={handleDateToOpen}
              >
                <Text style={[styles.dateInputText, !dateTo && styles.dateInputPlaceholder]}>
                  {dateTo || 'Select date'}
                </Text>
                <Icon name="calendar-outline" size={20} color="#8791a1" />
              </TouchableOpacity>
            </View>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Status Filter Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFromPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setStatusFilter('all');
                  setShowStatusModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, statusFilter === 'all' && styles.modalOptionTextActive]}>All Status</Text>
                {statusFilter === 'all' && <Icon name="checkmark" size={20} color="#f7ab18" />}
              </TouchableOpacity>
              {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map(status => (
                <TouchableOpacity
                  key={status}
                  style={styles.modalOption}
                  onPress={() => {
                    setStatusFilter(status);
                    setShowStatusModal(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, statusFilter === status && styles.modalOptionTextActive]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                  {statusFilter === status && <Icon name="checkmark" size={20} color="#f7ab18" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date From Picker Modal */}
      {console.log('Rendering Date From Modal, visible:', showDateFromPicker)}
      <Modal
        visible={showDateFromPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log('Modal onRequestClose called');
          setShowDateFromPicker(false);
        }}
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateFromPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select From Date</Text>
              <TouchableOpacity onPress={() => setShowDateFromPicker(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Year</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <TouchableOpacity
                        key={year}
                        style={[styles.datePickerOption, tempDateFrom.year === year && styles.datePickerOptionActive]}
                        onPress={() => setTempDateFrom({ ...tempDateFrom, year })}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateFrom.year === year && styles.datePickerOptionTextActive]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Month</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <TouchableOpacity
                        key={month}
                        style={[styles.datePickerOption, tempDateFrom.month === month && styles.datePickerOptionActive]}
                        onPress={() => {
                          const daysInMonth = getDaysInMonth(tempDateFrom.year, month);
                          setTempDateFrom({ 
                            ...tempDateFrom, 
                            month,
                            day: Math.min(tempDateFrom.day, daysInMonth)
                          });
                        }}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateFrom.month === month && styles.datePickerOptionTextActive]}>
                          {new Date(2000, month - 1).toLocaleString('default', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Day</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: getDaysInMonth(tempDateFrom.year, tempDateFrom.month) }, (_, i) => i + 1).map(day => (
                      <TouchableOpacity
                        key={day}
                        style={[styles.datePickerOption, tempDateFrom.day === day && styles.datePickerOptionActive]}
                        onPress={() => setTempDateFrom({ ...tempDateFrom, day })}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateFrom.day === day && styles.datePickerOptionTextActive]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDateFromPicker(false)}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmButton} 
                  onPress={() => {
                    console.log('Confirm button pressed');
                    handleDateFromConfirm();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Date To Picker Modal */}
      <Modal
        visible={showDateToPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          console.log('Modal onRequestClose called');
          setShowDateToPicker(false);
        }}
        statusBarTranslucent={true}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateToPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select To Date</Text>
              <TouchableOpacity onPress={() => setShowDateToPicker(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <View style={styles.datePickerContainer}>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Year</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <TouchableOpacity
                        key={year}
                        style={[styles.datePickerOption, tempDateTo.year === year && styles.datePickerOptionActive]}
                        onPress={() => setTempDateTo({ ...tempDateTo, year })}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateTo.year === year && styles.datePickerOptionTextActive]}>
                          {year}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Month</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                      <TouchableOpacity
                        key={month}
                        style={[styles.datePickerOption, tempDateTo.month === month && styles.datePickerOptionActive]}
                        onPress={() => {
                          const daysInMonth = getDaysInMonth(tempDateTo.year, month);
                          setTempDateTo({ 
                            ...tempDateTo, 
                            month,
                            day: Math.min(tempDateTo.day, daysInMonth)
                          });
                        }}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateTo.month === month && styles.datePickerOptionTextActive]}>
                          {new Date(2000, month - 1).toLocaleString('default', { month: 'short' })}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.datePickerColumn}>
                  <Text style={styles.datePickerLabel}>Day</Text>
                  <ScrollView style={styles.datePickerScroll} nestedScrollEnabled>
                    {Array.from({ length: getDaysInMonth(tempDateTo.year, tempDateTo.month) }, (_, i) => i + 1).map(day => (
                      <TouchableOpacity
                        key={day}
                        style={[styles.datePickerOption, tempDateTo.day === day && styles.datePickerOptionActive]}
                        onPress={() => setTempDateTo({ ...tempDateTo, day })}
                      >
                        <Text style={[styles.datePickerOptionText, tempDateTo.day === day && styles.datePickerOptionTextActive]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDateToPicker(false)}>
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.modalConfirmButton} 
                  onPress={() => {
                    console.log('Confirm button pressed');
                    handleDateToConfirm();
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#f7ab18" /></View>
      ) : (
        <>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="document-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          ) : (
            <FlatList
              data={filteredOrders}
              keyExtractor={(o, i) => String(o._id || o.id || i)}
              renderItem={renderItem}
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            />
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    paddingTop: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff'
  },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  filtersPanel: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    padding: 16,
    maxHeight: 400,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  filterSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
  },
  filterSelectText: {
    fontSize: 14,
    color: '#333',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
    zIndex: 1001,
    elevation: 1001,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextActive: {
    color: '#f7ab18',
    fontWeight: '600',
  },
  datePickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    maxHeight: 300,
  },
  datePickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  datePickerScroll: {
    maxHeight: 250,
    width: '100%',
  },
  datePickerOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 2,
    alignItems: 'center',
  },
  datePickerOptionActive: {
    backgroundColor: '#f7ab18',
  },
  datePickerOptionText: {
    fontSize: 16,
    color: '#666',
  },
  datePickerOptionTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  modalConfirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f7ab18',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
  },
  dateInputText: {
    fontSize: 14,
    color: '#333',
  },
  dateInputPlaceholder: {
    color: '#8791a1',
  },
  filterActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  resetButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetButtonText: {
    color: '#f7ab18',
    fontWeight: '600',
    fontSize: 14,
  },
  card: { 
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#eef2f7', 
    borderRadius: 12, 
    padding: 16, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderId: { 
    fontWeight: '700', 
    color: '#333',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  statusPending: { backgroundColor: '#ffc107' },
  statusConfirmed: { backgroundColor: '#17a2b8' },
  statusProcessing: { backgroundColor: '#007bff' },
  statusShipped: { backgroundColor: '#6f42c1' },
  statusDelivered: { backgroundColor: '#28a745' },
  statusCancelled: { backgroundColor: '#dc3545' },
  customerName: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  amount: { 
    color: '#333', 
    marginTop: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    color: '#8791a1',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
  },
});

export default VendorOrders;