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
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  
  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
      <style>{`
        .search-listings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }
        
        @media (max-width: 768px) {
          .search-listings-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          
          .search-listings-grid .listing-card {
            font-size: 14px;
          }
          
          .search-listings-grid .listing-card h4 {
            font-size: 16px !important;
          }
          
          .search-listings-grid .listing-card > div:first-child {
            height: 180px !important;
          }
          
          .search-listings-grid .listing-card > div:last-child {
            padding: 16px !important;
          }
          
          .search-dates-grid {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (max-width: 480px) {
          .search-listings-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
          }
          
          .search-listings-grid .listing-card > div:first-child {
            height: 160px !important;
          }
          
          .search-listings-grid .listing-card > div:last-child {
            padding: 12px !important;
            gap: 8px !important;
          }
          
          .search-listings-grid .listing-card h4 {
            font-size: 14px !important;
          }
          
          .search-listings-grid .listing-card > div:last-child > div:last-child span:first-child {
            font-size: 18px !important;
          }
        }
      `}</style>
      <style>{`
        @media (max-width: 768px) {
          .search-header-title {
            font-size: 24px !important;
          }
          .search-header-icon {
            width: 40px !important;
            height: 40px !important;
          }
          .search-header-icon svg {
            width: 20px !important;
            height: 20px !important;
          }
          .search-header-subtitle {
            font-size: 14px !important;
          }
        }
        @media (max-width: 480px) {
          .search-header-title {
            font-size: 22px !important;
          }
          .search-header-icon {
            width: 36px !important;
            height: 36px !important;
          }
          .search-header-icon svg {
            width: 18px !important;
            height: 18px !important;
          }
        }
      `}</style>
      <div style={{
        background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
        padding: '48px 24px',
        marginBottom: '32px',
        borderRadius: '0 0 24px 24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div className="search-header-icon" style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#31326F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(49, 50, 111, 0.2)'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
            </div>
            <h2 className="search-header-title" style={{
              margin: 0,
              fontSize: '32px',
              fontWeight: '700',
              color: '#1f2937',
              letterSpacing: '-0.5px'
            }}>
              Search
            </h2>
          </div>
          <p className="search-header-subtitle" style={{
            margin: 0,
            fontSize: '16px',
            color: '#6b7280',
            fontWeight: '400',
            lineHeight: '1.5'
          }}>
            Find your perfect stay
          </p>
        </div>
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

          {/* Dates - Calendar Picker */}
          <div>
            <label style={{ display: 'block', marginBottom: 12, fontWeight: 600, color: '#333', fontSize: '16px' }}>
              Check-in & Check-out Dates
            </label>
            
            {/* Date Display Buttons */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '16px'
            }}>
              <div
                onClick={() => setShowCalendar(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#637AB9'
                  e.currentTarget.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.background = 'white'
                }}
              >
                <span style={{ color: searchParams.checkIn ? '#1f2937' : '#9ca3af' }}>
                  {searchParams.checkIn 
                    ? new Date(searchParams.checkIn).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Check-in date'}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div
                onClick={() => setShowCalendar(true)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '2px solid #e5e7eb',
                  fontSize: '16px',
                  background: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#637AB9'
                  e.currentTarget.style.background = '#f9fafb'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb'
                  e.currentTarget.style.background = 'white'
                }}
              >
                <span style={{ color: searchParams.checkOut ? '#1f2937' : '#9ca3af' }}>
                  {searchParams.checkOut 
                    ? new Date(searchParams.checkOut).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Check-out date'}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
            </div>

            {/* Calendar Component */}
            {showCalendar && (
              <div style={{
                marginTop: '16px',
                padding: '20px',
                background: 'white',
                borderRadius: '16px',
                border: '2px solid #e5e7eb',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarMonth === 0) {
                        setCalendarMonth(11)
                        setCalendarYear(calendarYear - 1)
                      } else {
                        setCalendarMonth(calendarMonth - 1)
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f3f4f6'
                    }}
                  >
                    ❮
                  </button>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#111827'
                  }}>
                    {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarMonth === 11) {
                        setCalendarMonth(0)
                        setCalendarYear(calendarYear + 1)
                      } else {
                        setCalendarMonth(calendarMonth + 1)
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f3f4f6'
                    }}
                  >
                    ❯
                  </button>
                </div>

                {/* Calendar Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      padding: '8px 0'
                    }}>
                      {day}
                    </div>
                  ))}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px'
                }}>
                  {(() => {
                    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
                    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
                    const days = []
                    
                    // Empty cells for days before month starts
                    for (let i = 0; i < firstDay; i++) {
                      days.push(
                        <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '40px' }}></div>
                      )
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = formatDate(new Date(calendarYear, calendarMonth, day))
                      const dateObj = new Date(calendarYear, calendarMonth, day)
                      dateObj.setHours(0, 0, 0, 0)
                      const isPast = dateObj < today
                      const isToday = day === today.getDate() && 
                                     calendarMonth === today.getMonth() && 
                                     calendarYear === today.getFullYear()
                      const isCheckIn = searchParams.checkIn === dateStr
                      const isCheckOut = searchParams.checkOut === dateStr
                      
                      // Check if date is in range
                      let isInRange = false
                      if (searchParams.checkIn && searchParams.checkOut) {
                        const checkInDate = new Date(searchParams.checkIn)
                        const checkOutDate = new Date(searchParams.checkOut)
                        isInRange = dateObj > checkInDate && dateObj < checkOutDate
                      } else if (searchParams.checkIn && !searchParams.checkOut) {
                        const checkInDate = new Date(searchParams.checkIn)
                        isInRange = dateObj > checkInDate
                      }

                      days.push(
                        <div
                          key={day}
                          onClick={() => {
                            if (isPast) return
                            
                            if (!searchParams.checkIn || (searchParams.checkIn && searchParams.checkOut)) {
                              // Set check-in
                              setSearchParams({ ...searchParams, checkIn: dateStr, checkOut: '' })
                            } else if (searchParams.checkIn && !searchParams.checkOut) {
                              // Set check-out
                              const checkInDate = new Date(searchParams.checkIn)
                              if (dateObj <= checkInDate) {
                                alert('Check-out date must be after check-in date')
                                return
                              }
                              setSearchParams({ ...searchParams, checkOut: dateStr })
                            }
                          }}
                          style={{
                            aspectRatio: '1',
                            minHeight: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            cursor: isPast ? 'not-allowed' : 'pointer',
                            background: isCheckIn || isCheckOut
                              ? 'linear-gradient(135deg, #31326F 0%, #637AB9 100%)'
                              : isInRange
                              ? '#e0e7ff'
                              : isPast
                              ? '#f3f4f6'
                              : 'white',
                            color: isCheckIn || isCheckOut
                              ? 'white'
                              : isPast
                              ? '#9ca3af'
                              : '#111827',
                            border: isCheckIn || isCheckOut
                              ? '2px solid #31326F'
                              : isPast
                              ? '2px solid #d1d5db'
                              : '2px solid #e5e7eb',
                            fontWeight: isCheckIn || isCheckOut ? 700 : 500,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => {
                            if (!isPast && !isCheckIn && !isCheckOut) {
                              e.target.style.background = '#f9fafb'
                              e.target.style.borderColor = '#31326F'
                              e.target.style.transform = 'scale(1.05)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isPast && !isCheckIn && !isCheckOut) {
                              e.target.style.background = isInRange ? '#e0e7ff' : 'white'
                              e.target.style.borderColor = '#e5e7eb'
                              e.target.style.transform = 'scale(1)'
                            }
                          }}
                        >
                          <span>{day}</span>
                          {isToday && !isCheckIn && !isCheckOut && (
                            <span style={{
                              fontSize: '0.65rem',
                              marginTop: '2px',
                              color: '#31326F',
                              fontWeight: 700
                            }}>
                              Today
                            </span>
                          )}
                        </div>
                      )
                    }
                    
                    return days
                  })()}
                </div>

                {/* Close Calendar Button */}
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(false)}
                    style={{
                      padding: '10px 20px',
                      background: '#31326F',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#252550'
                      e.target.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#31326F'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
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
              onClick={handleSearch}
              style={{
                width: '100%',
                padding: '16px 24px',
                fontSize: '16px',
                fontWeight: 500,
                background: '#31326F',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(49, 50, 111, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#252550'
                e.target.style.transform = 'translateY(-1px)'
                e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#31326F'
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 2px 8px rgba(49, 50, 111, 0.2)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              Search
            </button>
          </div>
        </div>
      </div>

      {/* Results Section */}
      <div style={{ 
        marginTop: '40px', 
        padding: '0 20px',
        maxWidth: '1400px',
        marginLeft: 'auto',
        marginRight: 'auto'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <h3 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: '#1f2937',
            margin: 0
          }}>
            {loading ? 'Loading listings...' : 
             `${filteredListings.length} ${filteredListings.length === 1 ? 'listing' : 'listings'} found`}
          </h3>
          {filteredListings.length > 0 && (
            <button
              onClick={handleSearch}
              style={{
                padding: '10px',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#e5e7eb'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#f3f4f6'
              }}
              title="Refresh Results"
            >
              <img 
                src="/static/refreashIcon.png" 
                alt="Refresh" 
                style={{
                  width: '20px',
                  height: '20px',
                  objectFit: 'contain'
                }}
              />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '80px 20px',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              border: '4px solid #f3f4f6',
              borderTop: '4px solid #637AB9',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading amazing listings...</p>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : filteredListings.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
            background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
            borderRadius: '16px',
            border: '2px dashed #d1d5db',
            margin: '20px 0'
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
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
            </div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: 600,
              color: '#374151',
              margin: '0 0 8px 0'
            }}>
              No listings found
            </h3>
            <p style={{
              fontSize: '0.95rem',
              color: '#6b7280',
              margin: 0,
              maxWidth: '400px'
            }}>
              Try adjusting your search criteria or check back later for new listings.
            </p>
          </div>
        ) : (
          <div 
            className="search-listings-grid"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '24px'
            }}
          >
            {filteredListings.map(listing => (
              <div 
                key={listing.id} 
                className="listing-card"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
                onClick={() => navigate(`/guest/${guestId}/listing/${listing.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.15)'
                  e.currentTarget.style.borderColor = '#637AB9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'
                  e.currentTarget.style.borderColor = '#e5e7eb'
                }}
              >
                {/* Listing Image */}
                <div style={{ 
                  height: '220px', 
                  overflow: 'hidden',
                  position: 'relative',
                  background: '#f3f4f6'
                }}>
                  <img 
                    src={listing.photos?.[0] || '/static/no-photo.png'} 
                    alt={listing.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#374151',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {listing.serviceType || 'Listing'}
                  </div>
                  {listing.rating && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      backdropFilter: 'blur(10px)',
                      padding: '6px 10px',
                      borderRadius: '20px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>⭐</span>
                      <span>{listing.rating}</span>
                    </div>
                  )}
                </div>

                {/* Listing Details */}
                <div style={{ 
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  gap: '12px'
                }}>
                  <h4 style={{ 
                    fontSize: '18px', 
                    fontWeight: '700',
                    color: '#1f2937',
                    margin: 0,
                    lineHeight: '1.4',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {listing.title || 'Untitled Listing'}
                  </h4>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {listing.location || (listing.city && listing.province ? `${listing.city}, ${listing.province}` : listing.city || listing.province || 'Location not specified')}
                    </span>
                  </div>
                  
                  {/* Additional Info */}
                  <div style={{ 
                    display: 'flex',
                    gap: '16px',
                    fontSize: '13px',
                    color: '#6b7280',
                    flexWrap: 'wrap'
                  }}>
                    {listing.rooms && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>🛏️</span>
                        <span>{listing.rooms} {listing.rooms === 1 ? 'Room' : 'Rooms'}</span>
                      </div>
                    )}
                    {listing.maxGuests && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>👥</span>
                        <span>Up to {listing.maxGuests}</span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div style={{
                    marginTop: 'auto',
                    paddingTop: '12px',
                    borderTop: '1px solid #f3f4f6'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '4px'
                    }}>
                      <span style={{
                        fontSize: '22px',
                        fontWeight: '700',
                        color: '#1f2937'
                      }}>
                        ₱{listing.price?.toLocaleString() || '0'}
                      </span>
                      {listing.priceType === 'per_night' && (
                        <span style={{
                          fontSize: '14px',
                          color: '#6b7280',
                          fontWeight: '500'
                        }}>
                          / night
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default GuestSearch
