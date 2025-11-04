import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../../config/firebase'
import { collectionGroup, getDocs, query, where } from 'firebase/firestore'

const GuestSearch = () => {
  const { guestId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useState({
    where: '',
    checkIn: '',
    checkOut: '',
    guests: 1
  })
  const [listings, setListings] = useState([])
  const [filteredListings, setFilteredListings] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch all listings
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const querySnapshot = await getDocs(collectionGroup(db, 'Listings'))
        const listingsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setListings(listingsData)
        setFilteredListings(listingsData)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching listings:', error)
        setLoading(false)
      }
    }

    fetchListings()
  }, [])

  // Handle search functionality
  const handleSearch = () => {
    const filtered = listings.filter(listing => {
      const searchWhere = (searchParams.where || '').trim().toLowerCase()

      // Build a single normalized location string from possible listing fields
      const normalizedLocation = (
        listing.location ||
        listing.address ||
        listing.city ||
        listing.province ||
        listing.street ||
        listing.locationName ||
        ''
      ).toString().toLowerCase()

      // If search input is empty, treat as match (don't filter out)
      const locationMatch = !searchWhere || normalizedLocation.includes(searchWhere)
      
      const guestsMatch = !listing.maxGuests || listing.maxGuests >= searchParams.guests

      // If dates are provided, check availability
      if (searchParams.checkIn && searchParams.checkOut) {
        const checkIn = new Date(searchParams.checkIn)
        const checkOut = new Date(searchParams.checkOut)
        
        // Check if the listing is available for these dates
        const isAvailable = !listing.bookings?.some(booking => {
          const bookingStart = booking.checkIn?.toDate ? booking.checkIn.toDate() : new Date(booking.checkIn)
          const bookingEnd = booking.checkOut?.toDate ? booking.checkOut.toDate() : new Date(booking.checkOut)
          
          return (checkIn <= bookingEnd && checkOut >= bookingStart)
        })

        return locationMatch && guestsMatch && isAvailable
      }

      return locationMatch && guestsMatch
    })

    setFilteredListings(filtered)
  }

  return (
    <div className="notifications-layout">
      <div className="bookings-header">
        <div>
          <h2 className="bookings-title">Search</h2>
          <p className="bookings-subtext">Find your perfect stay</p>
        </div>
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Where */}
          <div>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333', fontSize: '16px' }}>
              Where (Location or Address)
            </label>
            <input
              type="text"
              placeholder="Enter location or address"
              value={searchParams.where}
              onChange={(e) => setSearchParams({ ...searchParams, where: e.target.value })}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '16px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#637AB9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Dates */}
          <div className="search-dates-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333', fontSize: '16px' }}>
                Check-in (Date)
              </label>
              <input
                type="date"
                value={searchParams.checkIn}
                onChange={(e) => setSearchParams({ ...searchParams, checkIn: e.target.value })}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#637AB9'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333', fontSize: '16px' }}>
                Check-out (Date)
              </label>
              <input
                type="date"
                value={searchParams.checkOut}
                onChange={(e) => setSearchParams({ ...searchParams, checkOut: e.target.value })}
                min={searchParams.checkIn}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#637AB9'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>

          {/* Who */}
          <div>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333', fontSize: '16px' }}>
              Who (Number of Guests)
            </label>
            <input
              type="number"
              placeholder="Number of guests"
              value={searchParams.guests}
              onChange={(e) => setSearchParams({ ...searchParams, guests: parseInt(e.target.value) || 1 })}
              min="1"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb',
                fontSize: '16px',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#637AB9'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          {/* Search Button */}
          <div style={{ marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleSearch}
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '18px',
                fontWeight: 600
              }}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div style={{ marginTop: '40px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '20px' }}>
          {loading ? 'Loading listings...' : 
           `${filteredListings.length} ${filteredListings.length === 1 ? 'listing' : 'listings'} found`}
        </h3>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
          gap: '24px' 
        }}>
          {filteredListings.map(listing => (
            <div 
              key={listing.id} 
              className="listing-card"
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                overflow: 'hidden',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => navigate(`/guest/${guestId}/view-listing/${listing.id}`)}
            >
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
                  right: '12px',
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

        {!loading && filteredListings.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: '#666'
          }}>
            No listings found matching your search criteria.
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestSearch

