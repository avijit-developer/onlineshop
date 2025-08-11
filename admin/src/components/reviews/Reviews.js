import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import './Reviews.css';

const Reviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterRating]);

  const fetchReviews = async () => {
    try {
      // Generate sample reviews data
      const sampleReviews = generateSampleReviews();
      setReviews(sampleReviews);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      toast.error('Failed to load reviews');
      setLoading(false);
    }
  };

  const generateSampleReviews = () => {
    return [
      {
        id: 1,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        productName: 'iPhone 14 Pro',
        vendorName: 'TechStore Pro',
        rating: 5,
        title: 'Excellent Product!',
        comment: 'This is an amazing phone. The camera quality is outstanding and the battery life is impressive. Highly recommended!',
        status: 'approved',
        isVerified: true,
        helpfulCount: 12,
        createdAt: '2024-01-15T10:30:00Z',
        images: ['https://via.placeholder.com/150x150/FF6B6B/FFFFFF?text=Review+1']
      },
      {
        id: 2,
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        productName: 'Samsung Galaxy S23',
        vendorName: 'TechStore Pro',
        rating: 4,
        title: 'Great phone, minor issues',
        comment: 'Overall a great phone with excellent performance. The only downside is the battery could be better.',
        status: 'pending',
        isVerified: true,
        helpfulCount: 8,
        createdAt: '2024-01-14T15:45:00Z',
        images: []
      },
      {
        id: 3,
        customerName: 'Mike Johnson',
        customerEmail: 'mike@example.com',
        productName: 'MacBook Air M2',
        vendorName: 'TechStore Pro',
        rating: 3,
        title: 'Average experience',
        comment: 'The laptop is good but not worth the high price. Performance is decent but I expected more.',
        status: 'approved',
        isVerified: false,
        helpfulCount: 3,
        createdAt: '2024-01-13T09:20:00Z',
        images: []
      },
      {
        id: 4,
        customerName: 'Sarah Wilson',
        customerEmail: 'sarah@example.com',
        productName: 'Nike Air Max',
        vendorName: 'Fashion Hub',
        rating: 5,
        title: 'Perfect fit and comfort',
        comment: 'These shoes are incredibly comfortable and look great. Perfect for both casual wear and workouts.',
        status: 'approved',
        isVerified: true,
        helpfulCount: 25,
        createdAt: '2024-01-12T14:20:00Z',
        images: ['https://via.placeholder.com/150x150/4ECDC4/FFFFFF?text=Review+2']
      },
      {
        id: 5,
        customerName: 'David Brown',
        customerEmail: 'david@example.com',
        productName: 'Coffee Maker',
        vendorName: 'Home Essentials',
        rating: 2,
        title: 'Disappointed with quality',
        comment: 'The coffee maker stopped working after a month. Poor quality and customer service was unhelpful.',
        status: 'rejected',
        isVerified: true,
        helpfulCount: 15,
        createdAt: '2024-01-11T11:15:00Z',
        images: []
      }
    ];
  };

  const handleStatusChange = (reviewId, newStatus) => {
    const updatedReviews = reviews.map(review => 
      review.id === reviewId 
        ? { ...review, status: newStatus }
        : review
    );
    setReviews(updatedReviews);
    toast.success(`Review ${newStatus} successfully`);
  };

  const handleDelete = (reviewId) => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      const updatedReviews = reviews.filter(review => review.id !== reviewId);
      setReviews(updatedReviews);
      toast.success('Review deleted successfully');
    }
  };

  const handleViewDetails = (review) => {
    setSelectedReview(review);
    setShowModal(true);
  };

  const getFilteredReviews = () => {
    let filtered = reviews;
    
    if (searchTerm) {
      filtered = filtered.filter(review => 
        review.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        review.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(review => review.status === filterStatus);
    }
    
    if (filterRating !== 'all') {
      filtered = filtered.filter(review => review.rating === parseInt(filterRating));
    }
    
    return filtered;
  };

  const getPaginatedData = (data) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return data.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(getFilteredReviews().length / itemsPerPage);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'approved':
        return 'status-approved';
      case 'pending':
        return 'status-pending';
      case 'rejected':
        return 'status-rejected';
      default:
        return 'status-pending';
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span key={index} className={`star ${index < rating ? 'filled' : 'empty'}`}>
        ★
      </span>
    ));
  };

  const getAverageRating = () => {
    const approvedReviews = reviews.filter(r => r.status === 'approved');
    if (approvedReviews.length === 0) return 0;
    const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
    return (totalRating / approvedReviews.length).toFixed(1);
  };

  const getRatingDistribution = () => {
    const approvedReviews = reviews.filter(r => r.status === 'approved');
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    approvedReviews.forEach(review => {
      distribution[review.rating]++;
    });
    return distribution;
  };

  if (loading) {
    return <div className="loading">Loading reviews...</div>;
  }

  const ratingDistribution = getRatingDistribution();

  return (
    <div className="reviews-container">
      <div className="page-header">
        <h1>Reviews & Ratings</h1>
        <div className="header-actions">
          <button onClick={() => window.print()} className="btn btn-secondary">
            Export Report
          </button>
        </div>
      </div>

      <div className="stats-cards">
        <div className="stat-card">
          <h3>Total Reviews</h3>
          <p>{reviews.length}</p>
        </div>
        <div className="stat-card">
          <h3>Average Rating</h3>
          <p>{getAverageRating()}/5</p>
        </div>
        <div className="stat-card">
          <h3>Pending Reviews</h3>
          <p>{reviews.filter(r => r.status === 'pending').length}</p>
        </div>
        <div className="stat-card">
          <h3>Verified Reviews</h3>
          <p>{reviews.filter(r => r.isVerified).length}</p>
        </div>
      </div>

      <div className="reviews-overview">
        <div className="rating-summary">
          <h3>Rating Distribution</h3>
          <div className="rating-bars">
            {[5, 4, 3, 2, 1].map(rating => {
              const count = ratingDistribution[rating];
              const total = reviews.filter(r => r.status === 'approved').length;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={rating} className="rating-bar">
                  <div className="rating-label">
                    <span>{rating} ★</span>
                    <span>{count}</span>
                  </div>
                  <div className="bar-container">
                    <div 
                      className="bar-fill" 
                      style={{width: `${percentage}%`}}
                    ></div>
                  </div>
                  <span className="percentage">{percentage.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="filter-controls">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by customer, product, or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-options">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
        </div>
      </div>

      <div className="reviews-table-container">
        <table className="reviews-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Vendor</th>
              <th>Rating</th>
              <th>Title</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {getPaginatedData(getFilteredReviews()).map((review) => (
              <tr key={review.id}>
                <td>
                  <div className="customer-info">
                    <strong>{review.customerName}</strong>
                    <p>{review.customerEmail}</p>
                    {review.isVerified && <span className="verified-badge">✓ Verified</span>}
                  </div>
                </td>
                <td>
                  <div className="product-info">
                    <strong>{review.productName}</strong>
                  </div>
                </td>
                <td>
                  <div className="vendor-info">
                    <span>{review.vendorName}</span>
                  </div>
                </td>
                <td>
                  <div className="rating-display">
                    {renderStars(review.rating)}
                    <span className="rating-text">{review.rating}/5</span>
                  </div>
                </td>
                <td>
                  <div className="review-title">
                    <strong>{review.title}</strong>
                    <p className="review-preview">{review.comment.substring(0, 50)}...</p>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(review.status)}`}>
                    {review.status}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <p>{new Date(review.createdAt).toLocaleDateString()}</p>
                    <small>{new Date(review.createdAt).toLocaleTimeString()}</small>
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => handleViewDetails(review)}
                      className="btn btn-info btn-sm"
                    >
                      View
                    </button>
                    {review.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(review.id, 'approved')}
                          className="btn btn-success btn-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(review.id, 'rejected')}
                          className="btn btn-danger btn-sm"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="btn btn-danger btn-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      )}

      {/* Review Details Modal */}
      {showModal && selectedReview && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Review Details</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">&times;</button>
            </div>
            <div className="modal-body">
              <div className="review-details">
                <div className="review-header">
                  <div className="customer-details">
                    <h3>{selectedReview.customerName}</h3>
                    <p>{selectedReview.customerEmail}</p>
                    {selectedReview.isVerified && <span className="verified-badge">✓ Verified Purchase</span>}
                  </div>
                  <div className="rating-details">
                    <div className="stars">{renderStars(selectedReview.rating)}</div>
                    <span className="rating-text">{selectedReview.rating}/5</span>
                  </div>
                </div>
                
                <div className="product-details">
                  <h4>Product: {selectedReview.productName}</h4>
                  <p>Vendor: {selectedReview.vendorName}</p>
                </div>
                
                <div className="review-content">
                  <h4>{selectedReview.title}</h4>
                  <p>{selectedReview.comment}</p>
                </div>
                
                {selectedReview.images && selectedReview.images.length > 0 && (
                  <div className="review-images">
                    <h4>Review Images</h4>
                    <div className="image-gallery">
                      {selectedReview.images.map((image, index) => (
                        <img key={index} src={image} alt={`Review ${index + 1}`} />
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="review-meta">
                  <div className="meta-item">
                    <label>Status:</label>
                    <span className={`status-badge ${getStatusBadgeClass(selectedReview.status)}`}>
                      {selectedReview.status}
                    </span>
                  </div>
                  <div className="meta-item">
                    <label>Helpful Votes:</label>
                    <span>{selectedReview.helpfulCount}</span>
                  </div>
                  <div className="meta-item">
                    <label>Date:</label>
                    <span>{new Date(selectedReview.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Close
              </button>
              {selectedReview.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      handleStatusChange(selectedReview.id, 'approved');
                      setShowModal(false);
                    }}
                    className="btn btn-success"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      handleStatusChange(selectedReview.id, 'rejected');
                      setShowModal(false);
                    }}
                    className="btn btn-danger"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews; 