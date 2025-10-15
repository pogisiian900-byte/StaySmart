import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const Earnings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const handleTabClick = (tab) => setActiveTab(tab);

  return (
    <div className="earnings-container">
      {/* 🧭 Top Navigation */}
      <div className="earnings-topbar">
        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        <h1>Host Earnings</h1>
      </div>

      {/* Tabs */}
      <div className="earnings-tabs">
        <button
          className={activeTab === "transactions" ? "tab-btn active" : "tab-btn"}
          onClick={() => handleTabClick("transactions")}
        >
          Transactions
        </button>
        <button
          className={activeTab === "payouts" ? "tab-btn active" : "tab-btn"}
          onClick={() => handleTabClick("payouts")}
        >
          Payouts
        </button>
      </div>

      {/* 🔍 Filter Area */}
      <div className="earnings-filters">
        <input type="text" placeholder="Search booking..." />
        <select>
          <option>All Services</option>
          <option>Studio Room</option>
          <option>Family Suite</option>
        </select>
        <select>
          <option>All Status</option>
          <option>Completed</option>
          <option>Pending</option>
          <option>Cancelled</option>
        </select>
        <button className="filter-btn">Filter</button>
      </div>
          <div className="overview-div">
              <div className="overview-card">
                <p> 💰Total Earnings (All-Time)</p>
                <p>₱145,300</p>
            </div>
            <div className="overview-card">
                <p>📅 This Month’s Earnings ₱12,500</p>
                <p>₱145,300</p>
            </div>
            <div className="overview-card">
                <p>🧾 Pending Payouts</p>
                <p>₱145,300</p>
            </div>
            <div className="overview-card">
                <p> 🏡 Total Bookings</p>
                <p>₱145,300</p>
            </div>
          </div>
         {/* Transactions Table */}
      {activeTab === "transactions" && (
        <div className="table-wrapper">
          <table className="earningTable">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Booker Full Name</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Service</th>
                <th>Amount Earned</th>
                <th>Booking Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#BKG-2025-001</td>
                <td>Juan Dela Cruz</td>
                <td>Sept 23, 2025</td>
                <td>Sept 25, 2025</td>
                <td>Studio Room</td>
                <td>₱4,500</td>
                <td className="status completed">Completed</td>
              </tr>
              <tr>
                <td>#BKG-2025-002</td>
                <td>Maria Santos</td>
                <td>Oct 5, 2025</td>
                <td>Oct 7, 2025</td>
                <td>Suite Room</td>
                <td>₱7,200</td>
                <td className="status pending">Pending</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Payouts Table */}
      {activeTab === "payouts" && (
        <div className="table-wrapper">
          <table className="earningTable">
            <thead>
              <tr>
                <th>Payout ID</th>
                <th>Date Issued</th>
                <th>Bank / Method</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>#PYT-2025-01</td>
                <td>Sept 26, 2025</td>
                <td>GCash</td>
                <td>REF12345</td>
                <td>₱4,500</td>
                <td className="status completed">Completed</td>
              </tr>
              <tr>
                <td>#PYT-2025-02</td>
                <td>Oct 8, 2025</td>
                <td>Bank Transfer</td>
                <td>REF67890</td>
                <td>₱7,200</td>
                <td className="status processing">Processing</td>
              </tr>
            </tbody>
          </table>
        </div>
   )}
    
    </div>
  );
};

export default Earnings;
