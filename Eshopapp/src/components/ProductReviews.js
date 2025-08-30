import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import AntDesign from 'react-native-vector-icons/AntDesign';
import api from '../utils/api';

const ProductReviews = ({ productId, onReviewPress }) => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (productId) {
      loadReviews();
    }
  }, [productId]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const res = await api.getProductReviewsPublic(productId, { page: 1, limit: 20 });
      const items = res?.data || [];
      // Normalize createdAt to Date objects for display
      const mapped = items.map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
      setReviews(mapped);
    } catch (e) {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.reviewerName}</Text>
          <Text style={styles.reviewDate}>
            {item.createdAt.toLocaleDateString()}
          </Text>
        </View>
        <View style={styles.ratingContainer}>
          {[1, 2, 3, 4, 5].map((star) => (
            <AntDesign
              key={star}
              name={star <= item.rating ? 'star' : 'staro'}
              size={16}
              color={star <= item.rating ? '#FFD700' : '#D3D3D3'}
            />
          ))}
        </View>
      </View>
      {item.title && (
        <Text style={styles.reviewTitle}>{item.title}</Text>
      )}
      <Text style={styles.reviewText}>{item.comment}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <AntDesign name="message1" size={48} color="#ccc" />
      <Text style={styles.emptyStateText}>No reviews yet</Text>
      <Text style={styles.emptyStateSubtext}>Be the first to review this product!</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Customer Reviews</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1976d2" />
          <Text style={styles.loadingText}>Loading reviews...</Text>
        </View>
      </View>
    );
  }

  const displayReviews = showAllReviews ? reviews : reviews.slice(0, 3);
  const hasMoreReviews = reviews.length > 3;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Customer Reviews</Text>
        {reviews.length > 0 && (
          <View style={styles.ratingSummary}>
            <Text style={styles.ratingText}>
              {(reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length).toFixed(1)}
            </Text>
            <Text style={styles.ratingCount}>({reviews.length} reviews)</Text>
          </View>
        )}
      </View>

      {reviews.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <FlatList
            data={displayReviews}
            renderItem={renderReviewItem}
            keyExtractor={(item, index) => item.id || index.toString()}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
          
          {hasMoreReviews && (
            <TouchableOpacity
              style={styles.showMoreButton}
              onPress={() => setShowAllReviews(!showAllReviews)}
            >
              <Text style={styles.showMoreText}>
                {showAllReviews ? 'Show Less' : `Show ${reviews.length - 3} More Reviews`}
              </Text>
              <AntDesign
                name={showAllReviews ? 'up' : 'down'}
                size={16}
                color="#1976d2"
              />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={styles.writeReviewButton}
            onPress={() => onReviewPress?.()}
          >
            <Text style={styles.writeReviewText}>Write a Review</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    marginVertical: 10,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ratingSummary: {
    alignItems: 'flex-end',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  ratingCount: {
    fontSize: 12,
    color: '#6c757d',
  },
  reviewItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  reviewDate: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  reviewText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6c757d',
    marginTop: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#adb5bd',
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    color: '#6c757d',
    fontSize: 14,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: '#f44336',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  showMoreText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
    marginRight: 4,
  },
  writeReviewButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 8,
  },
  writeReviewText: {
    fontSize: 14,
    color: '#1976d2',
    fontWeight: '600',
  },
});

export default ProductReviews;