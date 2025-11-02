import React from 'react'
import SlideshowWheel from './sildeshowWheel'
import Loading from './Loading'

const Services = ({ serviceData, loading }) => {
  return (
    <div>
      <div style={{ padding: "20px" }}>
      {loading ? (
        <Loading message="Loading listings..." />
      ) : serviceData && serviceData.length > 0 ? (
        <SlideshowWheel data={serviceData} useCase={"Services around your area:"} />
      ) : (
        <p style={{ textAlign: "center" }}>No Service listings found.</p>
      )}
    </div>
    </div>
  )
}

export default Services