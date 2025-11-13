import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'

const GuestWishlist = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [wishlistItems, setWishlistItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!guestId) return
    
    const q = query(
      collection(db, 'Wishlist'),
      where('guestId', '==', guestId)
    )
    
    const unsub = onSnapshot(q, (snap) => {
      const list = []
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }))
      // Sort client-side by createdAt desc to avoid composite index requirement
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      setWishlistItems(list)
      setLoading(false)
    }, (error) => {
      console.error('Error fetching wishlist:', error)
      setLoading(false)
    })
    
    return () => unsub()
  }, [guestId])

  const formatDate = (dateInput) => {
    if (!dateInput) return 'N/A'
    
    // Handle Firestore Timestamp
    if (dateInput?.toDate && typeof dateInput.toDate === 'function') {
      return dateInput.toDate().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      })
    }
    
    // Handle date string or Date object
    const date = new Date(dateInput)
    if (isNaN(date.getTime())) return 'N/A'
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    })
  }

  const renderStars = (rating) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <svg
          key={i}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill={i <= rating ? '#fbbf24' : 'none'}
          stroke={i <= rating ? '#fbbf24' : '#d1d5db'}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      )
    }
    return stars
  }

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.1rem', color: '#6b7280' }}>Loading your wishlist...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
        color: 'white'
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: 'white'
        }}>
          My Wishlist
        </h2>
        <p style={{
          fontSize: '1rem',
          margin: 0,
          color: 'rgba(255, 255, 255, 0.9)',
          fontWeight: 400
        }}>
          Your completed bookings and feedback
        </p>
      </div>

      {wishlistItems.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          borderRadius: '16px',
          border: '2px dashed #d1d5db'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
            </svg>
          </div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#374151',
            margin: '0 0 8px 0'
          }}>
            No wishlist items yet
          </h3>
          <p style={{
            fontSize: '0.95rem',
            color: '#6b7280',
            margin: 0,
            maxWidth: '400px'
          }}>
            Complete a booking to add it to your wishlist. Your feedback and ratings will be saved here.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: '20px'
        }}>
          {wishlistItems.map((item) => (
            <div
              key={item.id}
              style={{
                background: 'white',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                border: '1px solid #e5e7eb',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
              onClick={() => {
                if (item.listingId) {
                  navigate(`/guest/${guestId}/listing/${item.listingId}`)
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  margin: 0,
                  color: '#1f2937',
                  flex: 1
                }}>
                  {item.listingTitle || 'Unknown Listing'}
                </h3>
                {item.rating > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: '4px',
                    alignItems: 'center'
                  }}>
                    {renderStars(item.rating)}
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  color: '#6b7280'
                }}>
                  <span>Check-in:</span>
                  <span style={{ fontWeight: 500, color: '#374151' }}>
                    {formatDate(item.checkIn)}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  color: '#6b7280'
                }}>
                  <span>Check-out:</span>
                  <span style={{ fontWeight: 500, color: '#374151' }}>
                    {formatDate(item.checkOut)}
                  </span>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.9rem',
                  color: '#6b7280'
                }}>
                  <span>Total:</span>
                  <span style={{ fontWeight: 700, color: '#10b981', fontSize: '1rem' }}>
                    ₱{item.totalAmount || 0}
                  </span>
                </div>
              </div>

              {item.serviceThoughts && (
                <div style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: '#f0f9ff',
                  borderRadius: '8px',
                  border: '1px solid #bae6fd'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#1e40af',
                    marginBottom: '6px'
                  }}>
                    Your Thoughts:
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: '#374151',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    {item.serviceThoughts}
                  </p>
                </div>
              )}

              {item.improvements && (
                <div style={{
                  padding: '12px',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: '#991b1b',
                    marginBottom: '6px'
                  }}>
                    Suggestions:
                  </div>
                  <p style={{
                    fontSize: '0.9rem',
                    color: '#374151',
                    margin: 0,
                    lineHeight: 1.5
                  }}>
                    {item.improvements}
                  </p>
                </div>
              )}

              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e5e7eb',
                fontSize: '0.8rem',
                color: '#9ca3af',
                textAlign: 'right'
              }}>
                Completed: {formatDate(item.createdAt)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default GuestWishlist

