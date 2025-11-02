import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs, query, where,doc,deleteDoc } from "firebase/firestore";
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
  const handleDelete = async (id, type) => {
  try {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete this ${type === "draft" ? "draft" : "listing"}?`
    );
    if (!confirmDelete) return;

    // Determine collection
    const collectionName = type === "draft" ? "Drafts" : "Listings";

    // Delete document from Firestore
    await deleteDoc(doc(db, collectionName, id));

    // Update local state so UI updates immediately
    if (type === "draft") {
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } else {
      setListings((prev) => prev.filter((l) => l.id !== id));
    }

    alert(`${type === "draft" ? "Draft" : "Listing"} deleted successfully!`);
  } catch (error) {
    console.error("Error deleting document:", error);
    alert("Failed to delete. Please try again.");
  }
};


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

// ✅ Fixed: allow partial match (e.g., "room" inside "private room")
let displayedListings = [];

if (filterType === "all") {
  displayedListings = listings;
} else if (filterType === "drafts") {
  displayedListings = [];
} else {
  displayedListings = listings.filter((listing) =>
    listing.serviceType?.toLowerCase().includes(filterType.toLowerCase())
  );
}



  // 🔹 Navigation Bar
  const NavListing = () => (
    <div className="listingNav">
      <div className="listingIcon">
      </div>
      <div className="listing-buttons">
  <button
    className={filterType === "all" ? "active" : ""}
    onClick={() => setFilterType("all")}
  >
    All
  </button>
  <button
    className={filterType === "room" ? "active" : ""}
    onClick={() => setFilterType("room")}
  >
    Room
  </button>
  <button
    className={filterType === "service" ? "active" : ""}
    onClick={() => setFilterType("service")}
  >
    Service
  </button>
  <button
    className={filterType === "experience" ? "active" : ""}
    onClick={() => setFilterType("experience")}
  >
    Experience
  </button>
  <button
    className={filterType === "drafts" ? "active" : ""}
    onClick={() => setFilterType("drafts")}
  >
    Drafts
  </button>

  <button className="create-btn" onClick={createNewListing}>
    + Create new Listing
  </button>
</div>

    </div>
  );

  return (
    <div className="host-listing-main">
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
