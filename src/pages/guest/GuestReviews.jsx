import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import { auth } from "../../config/firebase";
import "./guest-reviews.css";

const GuestReviews = () => {
  const { guestId } = useParams();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, 5, 4, 3, 2, 1
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, highest, lowest

  useEffect(() => {
    if (!guestId) return;
    fetchGuestReviews();
  }, [guestId]);

  const fetchGuestReviews = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all listings
      const listingsSnapshot = await getDocs(collection(db, "Listings"));
      const allReviews = [];

      // Iterate through each listing to find reviews by this guest
      for (const listingDoc of listingsSnapshot.docs) {
        const listingData = listingDoc.data();
        
        if (listingData.ratings && Array.isArray(listingData.ratings)) {
          // Find reviews by this guest
          const guestReviews = listingData.ratings
            .filter((rating) => rating.userId === guestId)
            .map((rating) => ({
              id: `${listingDoc.id}-${rating.userId}-${rating.timestamp?.seconds || Date.now()}`,
              listingId: listingDoc.id,
              listingTitle: listingData.title || listingData.name || "Untitled Listing",
              listingImage: listingData.photos?.[0] || listingData.images?.[0] || null,
              rating: Number(rating.rating) || 0,
              comment: rating.comment || "",
              timestamp: rating.timestamp,
              userName: rating.userName || "Anonymous",
              createdAt: rating.timestamp?.seconds 
                ? new Date(rating.timestamp.seconds * 1000)
                : rating.timestamp?.toDate 
                ? rating.timestamp.toDate()
                : new Date()
            }));

          allReviews.push(...guestReviews);
        }
      }

      setReviews(allReviews);
    } catch (err) {
      console.error("Error fetching reviews:", err);
      setError("Failed to load your reviews. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort reviews
  const filteredAndSortedReviews = reviews
    .filter((review) => {
      if (filter === "all") return true;
      return review.rating === Number(filter);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return b.createdAt - a.createdAt;
        case "oldest":
          return a.createdAt - b.createdAt;
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        default:
          return 0;
      }
    });

  const formatDate = (date) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const StarRatingDisplay = ({ rating }) => {
    return (
      <div className="star-rating-display">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? "star filled" : "star empty"}
          >
            ★
          </span>
        ))}
        <span className="rating-number">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const stats = {
    total: reviews.length,
    average: reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
      : "0.0",
    fiveStar: reviews.filter((r) => r.rating === 5).length,
    fourStar: reviews.filter((r) => r.rating === 4).length,
    threeStar: reviews.filter((r) => r.rating === 3).length,
    twoStar: reviews.filter((r) => r.rating === 2).length,
    oneStar: reviews.filter((r) => r.rating === 1).length,
  };

  if (loading) {
    return (
      <div className="guest-reviews-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="guest-reviews-page">
      <div className="reviews-header">
        <div className="header-content">
          <button
            className="back-button"
            onClick={() => navigate(-1)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
            Back
          </button>
          <h1>My Reviews & Ratings</h1>
          <p>View and manage all your reviews and ratings</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="reviews-stats">
        <div className="stat-card highlight">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <span className="stat-label">Total Reviews</span>
            <span className="stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <span className="stat-label">Average Rating</span>
            <span className="stat-value">{stats.average}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <span className="stat-label">5-Star Reviews</span>
            <span className="stat-value">{stats.fiveStar}</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">👍</div>
          <div className="stat-content">
            <span className="stat-label">4-Star Reviews</span>
            <span className="stat-value">{stats.fourStar}</span>
          </div>
        </div>
      </div>

      {/* Filters and Sort */}
      {reviews.length > 0 && (
        <div className="reviews-controls">
          <div className="filter-group">
            <label>Filter by Rating:</label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
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
          <div className="sort-group">
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
            </select>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="reviews-content">
        {filteredAndSortedReviews.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📝</div>
            <h2>
              {reviews.length === 0
                ? "No Reviews Yet"
                : "No Reviews Match Your Filter"}
            </h2>
            <p>
              {reviews.length === 0
                ? "You haven't submitted any reviews yet. Start reviewing listings you've stayed at!"
                : "Try adjusting your filter to see more reviews."}
            </p>
            {reviews.length === 0 && (
              <button
                className="explore-button"
                onClick={() => navigate(`/guest/${guestId}`)}
              >
                Explore Listings
              </button>
            )}
          </div>
        ) : (
          <div className="reviews-list">
            {filteredAndSortedReviews.map((review) => (
              <div key={review.id} className="review-card">
                <div className="review-card-header">
                  <div
                    className="listing-image"
                    onClick={() =>
                      navigate(`/guest/${guestId}/listing/${review.listingId}`)
                    }
                  >
                    {review.listingImage ? (
                      <img
                        src={review.listingImage}
                        alt={review.listingTitle}
                        onError={(e) => {
                          e.target.style.display = "none";
                          const placeholder = e.target.parentElement.querySelector('.image-placeholder');
                          if (placeholder) {
                            placeholder.style.display = "flex";
                            placeholder.style.zIndex = "1";
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      className="image-placeholder" 
                      style={{ 
                        display: review.listingImage ? "none" : "flex",
                        zIndex: review.listingImage ? "0" : "1"
                      }}
                    >
                      <span>🏠</span>
                    </div>
                  </div>
                  <div className="review-card-info">
                    <h3
                      className="listing-title"
                      onClick={() =>
                        navigate(`/guest/${guestId}/listing/${review.listingId}`)
                      }
                    >
                      {review.listingTitle}
                    </h3>
                    <StarRatingDisplay rating={review.rating} />
                    <span className="review-date">
                      {formatDate(review.createdAt)}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <div className="review-comment">
                    <p>{review.comment}</p>
                  </div>
                )}
                <div className="review-actions">
                  <button
                    className="view-listing-button"
                    onClick={() =>
                      navigate(`/guest/${guestId}/listing/${review.listingId}`)
                    }
                  >
                    View Listing
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestReviews;

