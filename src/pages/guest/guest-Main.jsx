import React, { useRef, useEffect, useState } from "react";
import Guest_LoginModal from "./guest-loginModal";
import { useNavigate } from "react-router-dom";
import "./guest-Main.css";
import Footer from "../../components/Footer";
const GuestMain = () => {
  const navigate = useNavigate();
  const loginModalRef = useRef(null);
  const videoRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const statsRef = useRef(null);
  const hasAnimated = useRef(false);
  
  // Statistics data
  const [stats, setStats] = useState({
    activeUsers: 0,
    listingsAvailable: 0,
    totalBookings: 0,
    activeHosts: 0,
  });

  const targetStats = {
    activeUsers: 12500,
    listingsAvailable: 3420,
    totalBookings: 8920,
    activeHosts: 1850,
  };

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);

      // Parallax effect for video
      if (videoRef.current) {
        const videoPosition = scrollPosition * 0.5;
        videoRef.current.style.transform = `translateY(${videoPosition}px)`;
      }

      // Animate stats when section is visible (only once)
      if (statsRef.current && !hasAnimated.current) {
        const rect = statsRef.current.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
          hasAnimated.current = true;
          animateStats();
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    // Also check on initial load
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const animateStats = () => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const stepDuration = duration / steps;

    Object.keys(targetStats).forEach((key) => {
      const target = targetStats[key];
      const increment = target / steps;
      let current = 0;
      let step = 0;

      const timer = setInterval(() => {
        step++;
        current += increment;
        if (step >= steps) {
          current = target;
          clearInterval(timer);
        }
        setStats((prev) => ({
          ...prev,
          [key]: Math.floor(current),
        }));
      }, stepDuration);
    });
  };

  const openLogin = () => {
    loginModalRef.current?.open();
  };

  // Example listings data
  const featuredListings = [
    {
      id: 1,
      title: "Modern Apartment in City Center",
      location: "Manila, Philippines",
      price: "₱2,500",
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400"
    },
    {
      id: 2,
      title: "Beachfront Villa",
      location: "Boracay, Philippines",
      price: "₱5,000",
      rating: 4.9,
      image: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=400"
    },
    {
      id: 3,
      title: "Cozy Studio Apartment",
      location: "Makati, Philippines",
      price: "₱1,800",
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400"
    },
    {
      id: 4,
      title: "Luxury Penthouse",
      location: "BGC, Philippines",
      price: "₱8,000",
      rating: 5.0,
      image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400"
    },
  ];

  const categories = [
    { name: "Beach", icon: "🏖️", count: "1,234" },
    { name: "City", icon: "🏙️", count: "2,456" },
    { name: "Mountain", icon: "⛰️", count: "890" },
    { name: "Countryside", icon: "🌾", count: "567" },
    { name: "Tropical", icon: "🌴", count: "1,890" },
  ];

  return (
    <div className="guest-main">
      {/* Video Hero Section */}
      <section className="hero-section">
        <div className="hero-video-container">
          <video
            ref={videoRef}
            className="hero-video"
            autoPlay
            loop
            muted
            playsInline
          >
            <source src="/static/blueBG.mp4" type="video/mp4" />
            Your browser does not support the video tag.
          </video>
          <div className="hero-overlay"></div>
        </div>

        {/* Search Bar Overlay */}
        <div className={`hero-content ${isScrolled ? "scrolled" : ""}`}>
          <div className="hero-text">
            <h1 className="hero-title">Find your next adventure</h1>
            <p className="hero-subtitle">
              Discover amazing places to stay and experiences around the world
            </p>
          </div>

          <div className="hero-cta-container">
            <button 
              className="become-host-button" 
              onClick={() => navigate("/login")}
            >
              <span>Get Started</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5 12H19M19 12L12 5M19 12L12 19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* Static Content Sections */}
      <section className="content-section">
        {/* StaySmart by Numbers Section */}
        <div className="stats-section" ref={statsRef}>
          <div className="section-header">
            <h2>StaySmart by Numbers</h2>
            <p>Our growing community of travelers and hosts</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M16 7C16 9.20914 14.2091 11 12 11C9.79086 11 8 9.20914 8 7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 14C8.13401 14 5 17.134 5 21H19C19 17.134 15.866 14 12 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {stats.activeUsers.toLocaleString()}+
                </div>
                <div className="stat-label">Active Users</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {stats.listingsAvailable.toLocaleString()}+
                </div>
                <div className="stat-label">Listings Available</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {stats.totalBookings.toLocaleString()}+
                </div>
                <div className="stat-label">Total Bookings</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89317 18.7122 8.75608 18.1676 9.45768C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-number">
                  {stats.activeHosts.toLocaleString()}+
                </div>
                <div className="stat-label">Active Hosts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Categories Section */}
        <div className="categories-section">
          <div className="section-header">
            <h2>Explore by category</h2>
            <p>Discover unique stays and experiences</p>
          </div>
          <div className="categories-grid">
            {categories.map((category, index) => (
              <div key={index} className="category-card">
                <div className="category-icon">{category.icon}</div>
                <div className="category-info">
                  <h3>{category.name}</h3>
                  <p>{category.count} listings</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Featured Listings Section */}
        <div className="listings-section">
          <div className="section-header">
            <h2>Featured stays</h2>
            <p>Handpicked homes for your perfect getaway</p>
          </div>
          <div className="listings-grid">
            {featuredListings.map((listing) => (
              <div key={listing.id} className="listing-card">
                <div className="listing-image-container">
                  <img
                    src={listing.image}
                    alt={listing.title}
                    className="listing-image"
                  />
                  <button className="wishlist-button">
                    <svg
                      viewBox="0 0 32 32"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M16 28L6 18C3.5 15.5 2 12.5 2 9C2 5 5 2 9 2C11 2 13 3 14 4.5C15 3 17 2 19 2C23 2 26 5 26 9C26 12.5 24.5 15.5 22 18L16 28Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                </div>
                <div className="listing-info">
                  <div className="listing-header">
                    <h3>{listing.title}</h3>
                    <div className="listing-rating">
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="14"
                        height="14"
                      >
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                      </svg>
                      <span>{listing.rating}</span>
                    </div>
                  </div>
                  <p className="listing-location">{listing.location}</p>
                  <p className="listing-price">
                    <span className="price-amount">{listing.price}</span> / night
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
              <Footer />
        </div>
      </section>

      {/* Login Modal */}
      <Guest_LoginModal ref={loginModalRef} />
    </div>
  );
};

export default GuestMain;