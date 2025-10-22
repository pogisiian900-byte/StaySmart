import React from 'react'
import SlideshowWheel from './sildeshowWheel'

const Services = ({ serviceData, loading }) => {
  return (
    <div>
      <div style={{ padding: "20px" }}>
      {loading ? (
        <p style={{ textAlign: "center", fontSize: "18px" }}>
          Loading listings...
        </p>
      ) : serviceData && serviceData.length > 0 ? (
        <SlideshowWheel data={serviceData} useCase={"Services around your area:"} />
      ) : (
        <p style={{ textAlign: "center" }}>No room listings found.</p>
      )}
    </div>
    </div>
  )
}

export default Services