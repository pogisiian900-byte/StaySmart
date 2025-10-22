import React from 'react'
import { Outlet } from 'react-router-dom'

const GuestLayout = () => {
  return (
     <div className="guest-next-page">
      <Outlet />
    </div>
  )
}

export default GuestLayout