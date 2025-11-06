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
    <div className="notifications-layout">
      <div className="bookings-header">
        <div>
          <h2 className="bookings-title">My Favourites</h2>
          <p className="bookings-subtext">Your saved listings</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {favouriteListings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#666'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❤️</div>
          <h3 style={{ fontSize: '24px', fontWeight: '600', marginBottom: '8px', color: '#333' }}>
            No favourites yet
          </h3>
          <p style={{ fontSize: '16px', marginBottom: '24px' }}>
            Start exploring and save your favourite listings!
          </p>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/guest/${guestId}`)}
            style={{ padding: '12px 24px' }}
          >
            Browse Listings
          </button>
        </div>
      ) : (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
            {favouriteListings.length} {favouriteListings.length === 1 ? 'favourite' : 'favourites'}
          </h3>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '24px' 
          }}>
            {favouriteListings.map(listing => (
              <div 
                key={listing.id} 
                className="listing-card"
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => navigate(`/guest/${guestId}/listing/${listing.id}`)}
              >
                {/* Remove Favourite Button */}
                <button
                  onClick={(e) => removeFavourite(listing.id, e)}
                  disabled={removingId === listing.id}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                >
                  {removingId === listing.id ? (
                    <div style={{ fontSize: '14px' }}>...</div>
                  ) : (
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="24" 
                      height="24" 
                      viewBox="0 0 24 24" 
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ color: '#ef4444' }}
                    >
                      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                    </svg>
                  )}
                </button>

                {/* Listing Image */}
                <div style={{ 
                  height: '200px', 
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <img 
                    src={listing.photos?.[0] || '/static/no-photo.png'} 
                    alt={listing.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {listing.serviceType}
                  </div>
                </div>

                {/* Listing Details */}
                <div style={{ padding: '16px' }}>
                  <h4 style={{ 
                    fontSize: '18px', 
                    fontWeight: '600',
                    marginBottom: '8px'
                  }}>
                    {listing.title}
                  </h4>
                  <p style={{ 
                    fontSize: '14px',
                    color: '#666',
                    marginBottom: '8px'
                  }}>
                    {listing.location || (listing.city && listing.province ? `${listing.city}, ${listing.province}` : listing.city || listing.province || '')}
                  </p>
                  <p style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#333'
                  }}>
                    ₱{listing.price} {listing.priceType === 'per_night' ? 'per night' : ''}
                  </p>
                  
                  {/* Additional Info */}
                  <div style={{ 
                    marginTop: '12px',
                    display: 'flex',
                    gap: '16px',
                    fontSize: '14px',
                    color: '#666'
                  }}>
                    {listing.rooms && (
                      <span>🛏️ {listing.rooms} {listing.rooms === 1 ? 'Room' : 'Rooms'}</span>
                    )}
                    {listing.maxGuests && (
                      <span>👥 Up to {listing.maxGuests} guests</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default GuestFavourites

