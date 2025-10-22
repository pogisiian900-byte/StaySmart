import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import nothing from "/static/no photo.webp";

const Listings = ({ hostId }) => {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [filterType, setFilterType] = useState("all");

  // 🔹 Handlers
  const handleViewBookings = (id) => console.log("View bookings for:", id);
  const handleEdit = (id,serviceType) =>{
     navigate(`draft/${serviceType}/${id}`)
    
  };
  const handleDelete = (id, type) =>
    console.log("Delete", type === "draft" ? "draft" : "listing", id);
  const createNewListing = () => navigate("startingListing");
  const handleViewListing = (id) => navigate(id);

  // 🔹 Fetch Published Listings
  const fetchListings = async () => {
    try {
      const serviceRef = collection(db, "Listings");
      const q = query(serviceRef, where("hostId", "==", hostId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setListings(data);
    } catch (error) {
      console.error("Error fetching listings:", error);
    }
  };

  // 🔹 Fetch Drafts
  const fetchDrafts = async () => {
    try {
      const draftRef = collection(db, "Drafts");
      const q = query(draftRef, where("hostId", "==", hostId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDrafts(data);
    } catch (error) {
      console.error("Error fetching drafts:", error);
    }
  };

  useEffect(() => {
    if (hostId) {
      fetchListings();
      fetchDrafts();
    }
  }, [hostId]);

  // 🔹 Filter logic for listings
  let displayedListings = listings;
  if (filterType !== "all" && filterType !== "drafts") {
    displayedListings = listings.filter(
      (listing) =>
        listing.serviceType?.toLowerCase() === filterType.toLowerCase()
    );
  }

  // 🔹 Navigation Bar
  const NavListing = () => (
    <div className="listingNav">
      <div className="listingIcon">
        <p>My Listings</p>
      </div>
      <div className="listing-buttons">
        <button onClick={() => setFilterType("all")}>All</button>
        <button onClick={() => setFilterType("room")}>Room</button>
        <button onClick={() => setFilterType("service")}>Service</button>
        <button onClick={() => setFilterType("experience")}>Experience</button>
        <button onClick={() => setFilterType("drafts")}>Drafts</button>
        <button className="create-btn" onClick={createNewListing}>
          + Create new Listing
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <NavListing />
      <br />

      {/* ✅ If Drafts filter is selected */}
      {filterType === "drafts" ? (
        <section>
          <h2>Saved Drafts</h2>
          {drafts.length === 0 ? (
            <p>No drafts saved yet.</p>
          ) : (
            <div className="listings-group">
              {drafts.map((draft) => (
                <div className="listing-item draft" key={draft.id}>
                  <img
                    src={draft.photos?.[0] || nothing}
                    alt={draft.title || "Draft"}
                    width="250px"
                  />
                  <p className="listing-title">
                    {draft.generalData?.title || "Untitled Draft"}
                  </p>
                  <p>{draft.generalData?.location || "No location"}</p>
                  <p>₱{draft.generalData?.price || "N/A"}</p>
                  <p>Type: {draft.serviceType || "N/A"}</p>
                  <p style={{ color: "orange", fontWeight: "bold" }}>Draft</p>

                  <div className="listing-actions">
                    <button onClick={() => handleEdit(draft.id, draft.serviceType)}>
                      Continue Editing
                    </button>
                    <button onClick={() => handleDelete(draft.id, "draft")}>
                      Delete Draft
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        // ✅ Otherwise, show Published Listings
        <section>
          <h2>Published Listings</h2>
          {displayedListings.length === 0 ? (
            <p>No listings found.</p>
          ) : (
            <div className="listings-group">
              {displayedListings.map((listing) => (
                <div className="listing-item published" key={listing.id}>
                  <img
                    src={listing.photos?.[0] || nothing}
                    alt={listing.title || "Listing"}
                    width="250px"
                  />
                  <p className="listing-title">{listing.title || "Untitled"}</p>
                  <p>{listing.location || "No location"}</p>
                  <p>₱{listing.price || "N/A"}</p>
                  <p>Type: {listing.serviceType || "N/A"}</p>
                  <p className="rating-listing">
                    Rating: {listing.rating || "N/A"}
                  </p>

                  <div className="listing-actions">
                    <button onClick={() => handleViewBookings(listing.id)}>
                      See in Calendar
                    </button>
                    <button onClick={() => handleViewListing(listing.id)}>
                      View Listing
                    </button>
                    <button onClick={() => handleDelete(listing.id, "listing")}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Listings;
