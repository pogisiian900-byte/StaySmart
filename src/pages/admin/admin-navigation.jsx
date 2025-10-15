import React from 'react'
import Logo from '/static/Stay Smart Admin.png'

const Admin_Navigation = () => {
  return (
    <div className='admin-navBar'>
            <div className="admin-nav-button-group">
        <img src={Logo} alt="" width={"170px"}/>
            <button className="admin-dashboard-button admin-nav-selected">
                <span className="icon">🏠</span>
                <span className="label">Dashboard</span>
            </button>
            <button className="users-dashboard-button">
                <span className="icon">👤</span>
                <span className="label">Users</span>
            </button>
            <button className="listings-dashboard-button">
                <span className="icon">📂</span>
                <span className="label">Listings & Payments</span>
            </button>
            <button className="report-dashboard-button">
                <span className="icon">📊</span>
                <span className="label">Reports</span>
            </button>
            </div>
            
         <button className='hamburgButton-admin'>
                <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#000000ff"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>
        </button>
    </div>
  )
}

export default Admin_Navigation