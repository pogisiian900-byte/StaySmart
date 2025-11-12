import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, arrayRemove, collectionGroup, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'
import Loading from '../../components/Loading'

const GuestFavourites = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [favourites, setFavourites] = useState([])
  const [favouriteListings, setFavouriteListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [removingId, setRemovingId] = useState(null)

  // Load user's favourites
  useEffect(() => {
    if (!guestId) return
    loadFavourites()
  }, [guestId])

  const loadFavourites = async () => {
    try {
      setLoading(true)
      // Get user's favourites array
      const userDoc = await getDoc(doc(db, 'Users', guestId))
      if (userDoc.exists()) {
        const favIds = userDoc.data().favourites || []
        setFavourites(favIds)

        // Fetch all listings to find the favourite ones
        if (favIds.length > 0) {
          const querySnapshot = await getDocs(collectionGroup(db, 'Listings'))
          const allListings = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          
          // Filter to only show favourite listings
          const favListings = allListings.filter(listing => favIds.includes(listing.id))
          setFavouriteListings(favListings)
        } else {
          setFavouriteListings([])
        }
      }
    } catch (err) {
      console.error('Error loading favourites:', err)
    } finally {
      setLoading(false)
    }
  }

  const removeFavourite = async (listingId, e) => {
    e.stopPropagation()
    if (!guestId) return

    setRemovingId(listingId)
    try {
      const userRef = doc(db, 'Users', guestId)
      await updateDoc(userRef, {
        favourites: arrayRemove(listingId)
      })
      // Update local state
      setFavourites(prev => prev.filter(id => id !== listingId))
      setFavouriteListings(prev => prev.filter(listing => listing.id !== listingId))
    } catch (err) {
      console.error('Error removing favourite:', err)
      alert('Failed to remove favourite. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) {
    return <Loading fullScreen message="Loading your favourites..." />
  }

  return (
    <div style={{ 
      maxWidth: '1200px', 
      margin: '0 auto', 
      padding: '40px 20px',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ 
          fontSize: '32px', 
          fontWeight: '700', 
          color: '#1f2937',
          marginBottom: '8px'
        }}>
          My Favourites
        </h1>
        <p style={{ 
          fontSize: '16px', 
          color: '#6b7280',
          margin: 0
        }}>
          {favouriteListings.length > 0 
            ? `${favouriteListings.length} saved ${favouriteListings.length === 1 ? 'listing' : 'listings'}`
            : 'Your saved listings will appear here'
          }
        </p>
      </div>

      {favouriteListings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
          borderRadius: '20px',
          border: '2px dashed #e5e7eb'
        }}>
          <div style={{ 
            fontSize: '64px', 
            marginBottom: '24px',
            filter: 'grayscale(0.3)'
          }}>
            ❤️
          </div>
          <h2 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            marginBottom: '12px', 
            color: '#1f2937' 
          }}>
            No favourites yet
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#6b7280',
            marginBottom: '32px',
            maxWidth: '400px',
            margin: '0 auto 32px auto'
          }}>
            Start exploring and save your favourite listings to see them here!
          </p>
          <button
            onClick={() => navigate(`/guest/${guestId}`)}
            style={{ 
              padding: '14px 32px',
              fontSize: '16px',
              fontWeight: '600',
              color: 'white',
              background: 'linear-gradient(135deg, #31326F 0%, #5758a2 100%)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 12px rgba(49, 50, 111, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(49, 50, 111, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.3)'
            }}
          >
            Browse Listings
          </button>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
          gap: '24px' 
        }}>
          {favouriteListings.map(listing => (
            <div 
              key={listing.id}
              onClick={() => navigate(`/guest/${guestId}/listing/${listing.id}`)}
              style={{
                background: 'white',
                borderRadius: '16px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                position: 'relative',
                border: '1px solid #f3f4f6'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'
              }}
            >
              {/* Remove Favourite Button */}
              <button
                onClick={(e) => removeFavourite(listing.id, e)}
                disabled={removingId === listing.id}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '44px',
                  height: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  zIndex: 10,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.1)'
                  e.currentTarget.style.background = '#fef2f2'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.background = 'white'
                }}
              >
                {removingId === listing.id ? (
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    border: '2px solid #ef4444',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }} />
                ) : (
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    width="22" 
                    height="22" 
                    viewBox="0 0 24 24" 
                    fill="currentColor"
                    style={{ color: '#ef4444' }}
                  >
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                  </svg>
                )}
              </button>

              {/* Listing Image */}
              <div style={{ 
                height: '240px', 
                overflow: 'hidden',
                position: 'relative',
                background: '#f3f4f6'
              }}>
                <img 
                  src={listing.photos?.[0] || '/static/no photo.webp'} 
                  alt={listing.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform 0.3s ease'
                  }}
                  onError={(e) => {
                    e.target.src = '/static/no photo.webp'
                  }}
                />
                {listing.serviceType && (
                  <div style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#31326F',
                    textTransform: 'capitalize'
                  }}>
                    {Array.isArray(listing.serviceType) 
                      ? listing.serviceType[0] 
                      : listing.serviceType
                    }
                  </div>
                )}
              </div>

              {/* Listing Details */}
              <div style={{ padding: '20px' }}>
                <h3 style={{ 
                  fontSize: '20px', 
                  fontWeight: '600',
                  marginBottom: '8px',
                  color: '#1f2937',
                  lineHeight: '1.3'
                }}>
                  {listing.title}
                </h3>
                <p style={{ 
                  fontSize: '14px',
                  color: '#6b7280',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  {listing.location || (listing.city && listing.province ? `${listing.city}, ${listing.province}` : listing.city || listing.province || 'Location not specified')}
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f3f4f6'
                }}>
                  <div>
                    <p style={{
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#31326F',
                      margin: 0
                    }}>
                      ₱{listing.price}
                    </p>
                    {listing.priceType === 'per_night' && (
                      <p style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        margin: '2px 0 0 0'
                      }}>
                        per night
                      </p>
                    )}
                  </div>
                  {listing.rating && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#fef3c7',
                      padding: '4px 10px',
                      borderRadius: '8px'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#92400e' }}>
                        {typeof listing.rating === 'number' ? listing.rating.toFixed(1) : listing.rating}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default GuestFavourites

