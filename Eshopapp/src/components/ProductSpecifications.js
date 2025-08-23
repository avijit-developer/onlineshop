import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';

const ProductSpecifications = ({ product, onBrandPress }) => {
  if (!product) return null;

  const hasSpecifications = product.brand || product.category || product.vendor || product.tags?.length > 0;

  if (!hasSpecifications) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Product Information</Text>
      
      {/* Brand */}
      {product.brand && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Brand:</Text>
          <TouchableOpacity onPress={() => onBrandPress?.(product.brand)}>
            <Text style={styles.infoValue}>
              {typeof product.brand === 'object' ? product.brand.name : product.brand}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Category */}
      {product.category && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Category:</Text>
          <Text style={styles.infoValue}>
            {typeof product.category === 'object' ? product.category.name : product.category}
          </Text>
        </View>
      )}

      {/* SKU */}
      {product.sku && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>SKU:</Text>
          <Text style={styles.infoValue}>{product.sku}</Text>
        </View>
      )}

      {/* Tags */}
      {product.tags && product.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          <Text style={styles.infoLabel}>Tags:</Text>
          <View style={styles.tagsList}>
            {product.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tax Information */}
      {product.tax && product.tax > 0 && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tax:</Text>
          <Text style={styles.infoValue}>{product.tax}%</Text>
        </View>
      )}

      {/* Vendor Information */}
      {product.vendor && (
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sold by:</Text>
          <Text style={styles.infoValue}>
            {typeof product.vendor === 'object' ? product.vendor.companyName : product.vendor}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    marginVertical: 10,
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6c757d',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
    textAlign: 'right',
    flex: 1,
    marginLeft: 10,
  },
  tagsContainer: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  tag: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#1976d2',
    fontWeight: '500',
  },
});

export default ProductSpecifications;