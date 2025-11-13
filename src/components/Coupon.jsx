import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import Loading from './Loading'

const Coupon = () => {
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // 'all', 'active', 'expired', 'upcoming'

  useEffect(() => {
    const fetchListingsWithCoupons = async () => {
      try {
        setLoading(true)
        const listingsRef = collection(db, 'Listings')
        const snapshot = await getDocs(listingsRef)
        
        const listingsData = []
        snapshot.forEach((doc) => {
          const data = doc.data()
          // Only include listings that have a promo code or discount
          if (data.promoCode || data.discount) {
            listingsData.push({
              id: doc.id,
              ...data
            })
          }
        })
        
        setListings(listingsData)
      } catch (error) {
        console.error('Error fetching listings with coupons:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchListingsWithCoupons()
  }, [])

  const categorizedCoupons = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const categorized = {
      active: [],
      expired: [],
      upcoming: [],
      noDate: []
    }

    listings.forEach((listing) => {
      const hasStartDate = listing.discountStartDate
      const hasEndDate = listing.discountEndDate

      if (!hasStartDate && !hasEndDate) {
        categorized.noDate.push(listing)
        return
      }

      let startDate = null
      let endDate = null

      if (hasStartDate) {
        startDate = listing.discountStartDate?.toDate 
          ? listing.discountStartDate.toDate() 
          : new Date(listing.discountStartDate)
        startDate.setHours(0, 0, 0, 0)
      }

      if (hasEndDate) {
        endDate = listing.discountEndDate?.toDate 
          ? listing.discountEndDate.toDate() 
          : new Date(listing.discountEndDate)
        endDate.setHours(0, 0, 0, 0)
      }

      // Active: current date is between start and end, or no end date and past start, or no start date and before end
      if (
        (startDate && endDate && now >= startDate && now <= endDate) ||
        (startDate && !endDate && now >= startDate) ||
        (!startDate && endDate && now <= endDate)
      ) {
        categorized.active.push(listing)
      }
      // Expired: end date has passed
      else if (endDate && now > endDate) {
        categorized.expired.push(listing)
      }
      // Upcoming: start date is in the future
      else if (startDate && now < startDate) {
        categorized.upcoming.push(listing)
      }
      else {
        categorized.noDate.push(listing)
      }
    })

    return categorized
  }, [listings])

  const filteredCoupons = useMemo(() => {
    if (filter === 'all') {
      return listings
    }
    return categorizedCoupons[filter] || []
  }, [filter, listings, categorizedCoupons])

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A'
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const getStatusBadge = (listing) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const hasStartDate = listing.discountStartDate
    const hasEndDate = listing.discountEndDate

    if (!hasStartDate && !hasEndDate) {
      return { text: 'Active', color: '#10b981' }
    }

    let startDate = null
    let endDate = null

    if (hasStartDate) {
      startDate = listing.discountStartDate?.toDate 
        ? listing.discountStartDate.toDate() 
        : new Date(listing.discountStartDate)
      startDate.setHours(0, 0, 0, 0)
    }

    if (hasEndDate) {
      endDate = listing.discountEndDate?.toDate 
        ? listing.discountEndDate.toDate() 
        : new Date(listing.discountEndDate)
      endDate.setHours(0, 0, 0, 0)
    }

    if (endDate && now > endDate) {
      return { text: 'Expired', color: '#ef4444' }
    }
    if (startDate && now < startDate) {
      return { text: 'Upcoming', color: '#f59e0b' }
    }
    return { text: 'Active', color: '#10b981' }
  }

  if (loading) {
    return <Loading fullScreen message="Loading coupons..." />
  }

  return (
    <div style={{
      padding: '20px',
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '24px'
      }}>
        <h2 style={{
          fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: '#111827'
        }}>
          Available Coupons
        </h2>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          margin: 0
        }}>
          View all promotional codes and discounts across listings
        </p>
      </div>

      {/* Filter Buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'all', label: 'All', count: listings.length },
          { id: 'active', label: 'Active', count: categorizedCoupons.active.length },
          { id: 'upcoming', label: 'Upcoming', count: categorizedCoupons.upcoming.length },
          { id: 'expired', label: 'Expired', count: categorizedCoupons.expired.length }
        ].map((filterOption) => (
          <button
            key={filterOption.id}
            onClick={() => setFilter(filterOption.id)}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: filter === filterOption.id ? '#667eea' : '#f3f4f6',
              color: filter === filterOption.id ? 'white' : '#374151',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              if (filter !== filterOption.id) {
                e.target.style.background = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== filterOption.id) {
                e.target.style.background = '#f3f4f6'
              }
            }}
          >
            <span>{filterOption.label}</span>
            <span style={{
              background: filter === filterOption.id ? 'rgba(255, 255, 255, 0.3)' : '#d1d5db',
              color: filter === filterOption.id ? 'white' : '#374151',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {filterOption.count}
            </span>
          </button>
        ))}
      </div>

      {/* Coupons List */}
      {filteredCoupons.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
        }}>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="64" 
            height="64" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            viewBox="0 0 24 24"
            style={{ color: '#9ca3af', marginBottom: '16px' }}
          >
            <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
            <path d="m15 9-6 6"/>
            <path d="M9 9h.01"/>
            <path d="M15 15h.01"/>
          </svg>
          <p style={{
            fontSize: '1rem',
            color: '#6b7280',
            margin: 0
          }}>
            No coupons found for this filter
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {filteredCoupons.map((listing) => {
            const status = getStatusBadge(listing)
            return (
              <div
                key={listing.id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  border: '1px solid #e5e7eb',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
              >
                {/* Status Badge */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    background: status.color + '20',
                    color: status.color,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {status.text}
                  </span>
                </div>

                {/* Listing Title */}
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  margin: '0 0 12px 0',
                  color: '#111827'
                }}>
                  {listing.title || listing.name || 'Untitled Listing'}
                </h3>

                {/* Discount Info */}
                <div style={{
                  marginBottom: '16px',
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="20" 
                      height="20" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      viewBox="0 0 24 24"
                      style={{ color: '#667eea' }}
                    >
                      <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                      <path d="m15 9-6 6"/>
                      <path d="M9 9h.01"/>
                      <path d="M15 15h.01"/>
                    </svg>
                    <span style={{
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      color: '#667eea'
                    }}>
                      {listing.discount || 0}% OFF
                    </span>
                  </div>

                  {listing.promoCode && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'white',
                      borderRadius: '6px',
                      border: '2px dashed #667eea'
                    }}>
                      <p style={{
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        margin: '0 0 4px 0',
                        fontWeight: 500
                      }}>
                        Promo Code:
                      </p>
                      <p style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#667eea',
                        margin: 0,
                        fontFamily: 'monospace',
                        letterSpacing: '2px'
                      }}>
                        {listing.promoCode}
                      </p>
                    </div>
                  )}
                </div>

                {/* Date Range */}
                {(listing.discountStartDate || listing.discountEndDate) && (
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    marginBottom: '12px'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>Valid:</strong> {formatDate(listing.discountStartDate) || 'No start date'} - {formatDate(listing.discountEndDate) || 'No end date'}
                    </div>
                  </div>
                )}

                {/* Description */}
                {listing.discountDescription && (
                  <p style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    margin: '0 0 12px 0',
                    lineHeight: '1.5'
                  }}>
                    {listing.discountDescription}
                  </p>
                )}

                {/* Price Info */}
                {listing.price && (
                  <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280'
                    }}>
                      Original Price:
                    </span>
                    <span style={{
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#111827'
                    }}>
                      ₱{Number(listing.price).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Coupon

