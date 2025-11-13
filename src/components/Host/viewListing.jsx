import React, { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import nothing from "/static/no photo.webp";
import Loading from "../../components/Loading";

const ViewListing = () => {
  const { hostId, listingId } = useParams();
  const [selectedListing, setSelectedListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [showPhotoError, setShowPhotoError] = useState(false);
  const [multiPhotos, setMultiPhotos] = useState([null, null, null, null]);
// 🔹 New state & ref for confirmation
const confirmDialogRef = useRef(null);
const [updating, setUpdating] = useState(false);
// 🔹 Image zoom/lightbox state
const [selectedImage, setSelectedImage] = useState(null);
const [imageIndex, setImageIndex] = useState(0);

  
  const [generalData, setGeneralData] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    maxGuests: "",
    amenities: [],
    propertyType: "",
    bedrooms: 0,
    beds: 0,
    bathrooms: 0,
    roomType: "",
    category: "",
    duration: 0,
    groupSizeLimit: 0,
    meetingPoint: "",
    serviceCategory: "",
    serviceDuration: 0,
    availabilityHours: "",
    serviceArea: "",
    rating: 0,
    discount: 0
  });
  
  // 🔹 Promo/Discount States
  const [discountData, setDiscountData] = useState({
    discount: 0,
    promoCode: "",
    startDate: "",
    endDate: "",
    description: ""
  });
  const [savingDiscount, setSavingDiscount] = useState(false);
  
  // 🔹 Dialog Refs
  const editDialogRef = useRef(null);
  const discountDialogRef = useRef(null);

  // 🔹 Handlers for dialog open/close
  const handleEdit = () => editDialogRef.current?.showModal();
  const handleDiscount = () => {
    // Pre-populate discount data if exists
    if (selectedListing?.discount) {
      setDiscountData({
        discount: selectedListing.discount || 0,
        promoCode: selectedListing.promoCode || "",
        startDate: selectedListing.discountStartDate || "",
        endDate: selectedListing.discountEndDate || "",
        description: selectedListing.discountDescription || ""
      });
    } else {
      setDiscountData({
        discount: 0,
        promoCode: "",
        startDate: "",
        endDate: "",
        description: ""
      });
    }
    discountDialogRef.current?.showModal();
  };
  const closeEditDialog = () => editDialogRef.current?.close();
  const closeDiscountDialog = () => discountDialogRef.current?.close();

  
const handleUpdate = async () => {
  confirmDialogRef.current?.showModal(); // Show confirmation first
};
  // If user confirms
const confirmUpdate = async () => {
  try {
    setUpdating(true);
    confirmDialogRef.current?.close();

    const updatedPhotos = [
      photo || selectedListing.photos?.[0] || nothing,
      ...multiPhotos.map((p, i) => p || selectedListing.photos?.[i + 1] || null),
    ].filter(Boolean);

    const docRef = doc(db, "Listings", listingId);
    await updateDoc(docRef, {
      ...generalData,
      photos: updatedPhotos,
      lastUpdated: new Date(),
    });

    alert("✅ Listing updated successfully!");
    closeEditDialog();
    navigate(`/host/${hostId}`)
  } catch (error) {
    console.error("Update failed:", error);
    alert("❌ Failed to update listing. Please try again.");
  } finally {
    setUpdating(false);
  }
};
  useEffect(() => {
  const fetchListing = async () => {
    try {
      if (!listingId) {
        console.warn("No listingId found in route params");
        return;
      }

      const docRef = doc(db, "Listings", listingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const listingData = { id: docSnap.id, ...docSnap.data() };
        setSelectedListing(listingData);
        setGeneralData({
          title: listingData.title || "",
          description: listingData.description || "",
          price: listingData.price || "",
          location: listingData.location || "",
          maxGuests: listingData.maxGuests || "",
          amenities: listingData.amenities || [],
          propertyType: listingData.propertyType || "",
          bedrooms: listingData.bedrooms || 0,
          beds: listingData.beds || 0,
          bathrooms: listingData.bathrooms || 0,
          roomType: listingData.roomType || "",
          category: listingData.category || "",
          duration: listingData.duration || 0,
          groupSizeLimit: listingData.groupSizeLimit || 0,
          meetingPoint: listingData.meetingPoint || "",
          serviceCategory: listingData.serviceCategory || "",
          serviceDuration: listingData.serviceDuration || 0,
          availabilityHours: listingData.availabilityHours || "",
          serviceArea: listingData.serviceArea || "",
          rating: listingData.rating || 0,
          discount: listingData.discount || 0
        });
        
        // Set discount data if exists
        if (listingData.discount) {
          setDiscountData({
            discount: listingData.discount || 0,
            promoCode: listingData.promoCode || "",
            startDate: listingData.discountStartDate || "",
            endDate: listingData.discountEndDate || "",
            description: listingData.discountDescription || ""
          });
        }
      } else {
        console.log("No such listing found!");
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchListing();
}, [listingId]);


  if (loading) return <Loading fullScreen message="Loading listing details..." />;
  if (!selectedListing)
    return <Loading fullScreen message="Listing not found. It may have been removed." />;

  // ✅ Cloudinary Upload
  const uploadImageToCloudinary = async (file) => {
    const uploadPreset = "listing_uploads";
    const cloudName = "ddckoojwo";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  // ✅ Single & Multiple Image Upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await uploadImageToCloudinary(file);
        setPhoto(url);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
  };

  const handleMultiFileChange = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToCloudinary(file);
      const updated = [...multiPhotos];
      updated[index] = url;
      setMultiPhotos(updated);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhoto(null);
  };

  const handleRemoveMultiPhoto = (e, index) => {
    e.stopPropagation();
    const newPhotos = [...multiPhotos];
    newPhotos[index] = null;
    setMultiPhotos(newPhotos);
  };

  const handleChange = (field, value) => {
    setGeneralData((prev) => ({ ...prev, [field]: value }));
  };

  // 🔹 Handle discount data change
  const handleDiscountChange = (field, value) => {
    setDiscountData((prev) => ({ ...prev, [field]: value }));
  };

  // 🔹 Save/Update discount
  const handleSaveDiscount = async () => {
    if (!discountData.discount || discountData.discount <= 0 || discountData.discount > 100) {
      alert("Please enter a valid discount percentage (1-100%)");
      return;
    }

    setSavingDiscount(true);
    try {
      const docRef = doc(db, "Listings", listingId);
      await updateDoc(docRef, {
        discount: Number(discountData.discount),
        promoCode: discountData.promoCode.trim() || null,
        discountStartDate: discountData.startDate || null,
        discountEndDate: discountData.endDate || null,
        discountDescription: discountData.description.trim() || null,
        discountUpdatedAt: new Date()
      });

      // Update local state
      setSelectedListing((prev) => ({
        ...prev,
        discount: Number(discountData.discount),
        promoCode: discountData.promoCode.trim() || null,
        discountStartDate: discountData.startDate || null,
        discountEndDate: discountData.endDate || null,
        discountDescription: discountData.description.trim() || null
      }));

      setGeneralData((prev) => ({ ...prev, discount: Number(discountData.discount) }));

      alert("✅ Discount saved successfully!");
      closeDiscountDialog();
    } catch (error) {
      console.error("Error saving discount:", error);
      alert("❌ Failed to save discount. Please try again.");
    } finally {
      setSavingDiscount(false);
    }
  };

  // 🔹 Remove discount
  const handleRemoveDiscount = async () => {
    if (!window.confirm("Are you sure you want to remove this discount?")) {
      return;
    }

    setSavingDiscount(true);
    try {
      const docRef = doc(db, "Listings", listingId);
      await updateDoc(docRef, {
        discount: 0,
        promoCode: null,
        discountStartDate: null,
        discountEndDate: null,
        discountDescription: null
      });

      // Update local state
      setSelectedListing((prev) => ({
        ...prev,
        discount: 0,
        promoCode: null,
        discountStartDate: null,
        discountEndDate: null,
        discountDescription: null
      }));

      setGeneralData((prev) => ({ ...prev, discount: 0 }));
      setDiscountData({
        discount: 0,
        promoCode: "",
        startDate: "",
        endDate: "",
        description: ""
      });

      alert("✅ Discount removed successfully!");
      closeDiscountDialog();
    } catch (error) {
      console.error("Error removing discount:", error);
      alert("❌ Failed to remove discount. Please try again.");
    } finally {
      setSavingDiscount(false);
    }
  };

  const ListingHeader = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24px',
      gap: '16px'
    }}>
      <button 
        onClick={() => navigate(-1)}
        style={{
          background: 'white',
          border: '2px solid #e5e7eb',
          borderRadius: '12px',
          padding: '12px 20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          color: '#374151',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
        }}
        onMouseEnter={(e) => {
          e.target.style.borderColor = '#667eea'
          e.target.style.color = '#667eea'
          e.target.style.transform = 'translateX(-4px)'
        }}
        onMouseLeave={(e) => {
          e.target.style.borderColor = '#e5e7eb'
          e.target.style.color = '#374151'
          e.target.style.transform = 'translateX(0)'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
        <span>Back</span>
      </button>

      <button 
        onClick={handleEdit}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          borderRadius: '12px',
          padding: '12px 24px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 600,
          color: 'white',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'translateY(-2px)'
          e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'translateY(0)'
          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
        </svg>
        <span>Edit Listing</span>
      </button>
    </div>
  );

  const ImageGroup = ({ photos = [] }) => {
    const mainPhoto = photos[0] || nothing;
    const subPhotos = photos.slice(1, 5);
    const allPhotos = useMemo(() => 
      photos.filter(photo => photo && photo !== nothing), 
      [photos]
    );

    const handleImageClick = (photo, index) => {
      if (photo && photo !== nothing) {
        const actualIndex = allPhotos.findIndex(p => p === photo);
        setSelectedImage(photo);
        setImageIndex(actualIndex >= 0 ? actualIndex : 0);
      }
    };

    const closeLightbox = () => {
      setSelectedImage(null);
    };

    const nextImage = (e) => {
      e.stopPropagation();
      if (allPhotos.length > 0) {
        const nextIndex = (imageIndex + 1) % allPhotos.length;
        setImageIndex(nextIndex);
        setSelectedImage(allPhotos[nextIndex]);
      }
    };

    const prevImage = (e) => {
      e.stopPropagation();
      if (allPhotos.length > 0) {
        const prevIndex = (imageIndex - 1 + allPhotos.length) % allPhotos.length;
        setImageIndex(prevIndex);
        setSelectedImage(allPhotos[prevIndex]);
      }
    };

    useEffect(() => {
      if (!selectedImage) return;

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeLightbox();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (allPhotos.length > 0) {
            const nextIdx = (imageIndex + 1) % allPhotos.length;
            setImageIndex(nextIdx);
            setSelectedImage(allPhotos[nextIdx]);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (allPhotos.length > 0) {
            const prevIdx = (imageIndex - 1 + allPhotos.length) % allPhotos.length;
            setImageIndex(prevIdx);
            setSelectedImage(allPhotos[prevIdx]);
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }, [selectedImage, imageIndex, allPhotos]);

    return (
      <>
        <div className="image-group-container">
          <div 
            className="main-image" 
            onClick={() => handleImageClick(mainPhoto, 0)}
            style={{ cursor: mainPhoto !== nothing ? 'zoom-in' : 'default' }}
          >
            <img
              src={mainPhoto}
              alt="Main Listing"
              width="100%"
              onError={(e) => (e.target.src = nothing)}
            />
          </div>

          <div className="sub-images-grid">
            {subPhotos.map((photo, index) => (
              <img
                key={index}
                src={photo || nothing}
                alt={`Listing ${index + 1}`}
                onError={(e) => (e.target.src = nothing)}
                onClick={() => handleImageClick(photo, index + 1)}
                style={{ cursor: photo && photo !== nothing ? 'zoom-in' : 'default' }}
              />
            ))}
            {Array.from({ length: 4 - subPhotos.length }).map((_, i) => (
              <img key={`empty-${i}`} src={nothing} alt="Empty slot" />
            ))}
          </div>
        </div>

        {selectedImage && (
          <div 
            className="image-lightbox-overlay" 
            onClick={closeLightbox}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.95)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px',
              cursor: 'pointer'
            }}
          >
            <button 
              onClick={closeLightbox} 
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.9)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10001,
                transition: 'all 0.3s ease',
                color: '#333'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'white'
                e.target.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.9)'
                e.target.style.transform = 'scale(1)'
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {allPhotos.length > 1 && (
              <>
                <button 
                  onClick={prevImage} 
                  aria-label="Previous image"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '20px',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10001,
                    transition: 'all 0.3s ease',
                    color: '#333'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'white'
                    e.target.style.transform = 'translateY(-50%) scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.9)'
                    e.target.style.transform = 'translateY(-50%) scale(1)'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <button 
                  onClick={nextImage} 
                  aria-label="Next image"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '20px',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 10001,
                    transition: 'all 0.3s ease',
                    color: '#333'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'white'
                    e.target.style.transform = 'translateY(-50%) scale(1.1)'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.9)'
                    e.target.style.transform = 'translateY(-50%) scale(1)'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </>
            )}
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default'
              }}
            >
              <img
                src={selectedImage}
                alt="Zoomed listing"
                style={{
                  maxWidth: '100%',
                  maxHeight: '90vh',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                }}
                onError={(e) => (e.target.src = nothing)}
              />
              {allPhotos.length > 1 && (
                <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  zIndex: 10001
                }}>
                  {imageIndex + 1} / {allPhotos.length}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  const InfoBlock = ({ icon, label, value }) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '20px',
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
      width: '100%'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#f9fafb'
      e.currentTarget.style.borderColor = '#667eea'
      e.currentTarget.style.transform = 'translateY(-2px)'
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.15)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'white'
      e.currentTarget.style.borderColor = '#e5e7eb'
      e.currentTarget.style.transform = 'translateY(0)'
      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
    }}
    >
      {icon && (
        <div style={{
          fontSize: '32px',
          flexShrink: 0,
          width: '56px',
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderRadius: '12px'
        }}>
          {icon}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
        <div style={{ 
          fontSize: '0.75rem', 
          color: '#6b7280', 
          fontWeight: 600, 
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {label}
        </div>
        <div style={{ 
          fontSize: '1.25rem', 
          color: '#111827', 
          fontWeight: 700,
          wordBreak: 'break-word',
          lineHeight: '1.4'
        }}>
          {value || "N/A"}
        </div>
      </div>
    </div>
  );

  const InfoSection = ({ title, children }) => (
    <div style={{
      marginBottom: '0',
      width: '100%'
    }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#111827',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '2px solid #e5e7eb'
      }}>
        {title}
      </h3>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        width: '100%'
      }}>
        {children}
      </div>
    </div>
  );

  const { serviceType } = selectedListing;

  return (
    <>
      <style>{`
        .info-sections-grid {
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 32px !important;
          width: 100% !important;
        }
        @media (max-width: 968px) {
          .info-sections-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
      <div className="view-listing" style={{
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '24px 20px',
        fontFamily: '"Inter", sans-serif',
        background: '#f9fafb',
        minHeight: '100vh',
        width: '100%'
      }}>
        <ListingHeader />
      
      {/* Hero Section with Image and Title */}
      <div style={{
        background: 'white',
        borderRadius: '20px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px'
      }}>
        <ImageGroup photos={selectedListing.photos} />
        
        <div style={{
          padding: '32px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h1 style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '12px',
                lineHeight: '1.2'
              }}>
                {selectedListing.title}
              </h1>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#6b7280',
                  fontSize: '0.95rem'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>{selectedListing.location || "Location not specified"}</span>
                </div>
                {selectedListing.rating > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#fef3c7',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#92400e'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span>{Number(selectedListing.rating).toFixed(1)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '20px 28px',
              borderRadius: '16px',
              color: 'white',
              textAlign: 'center',
              boxShadow: '0 8px 24px rgba(102, 126, 234, 0.3)'
            }}>
              <div style={{
                fontSize: '0.875rem',
                opacity: 0.9,
                marginBottom: '4px'
              }}>
                Price
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 700
              }}>
                ₱{Number(selectedListing.price).toLocaleString()}
              </div>
            </div>
          </div>

          <p style={{
            fontSize: '1rem',
            lineHeight: '1.7',
            color: '#4b5563',
            marginTop: '20px',
            padding: '20px',
            background: '#f9fafb',
            borderRadius: '12px',
            border: '1px solid #e5e7eb'
          }}>
            {selectedListing.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Main Content Section */}
      <div className="view-listing-content" style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        marginBottom: '32px',
        width: '100%',
        maxWidth: '100%'
      }}>
        {/* Side by Side Layout for Basic Information and Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
          marginBottom: '32px',
          width: '100%'
        }}
        className="info-sections-grid"
        >
          {/* Basic Information */}
          <InfoSection title="Basic Information">
            <InfoBlock icon="📍" label="Location" value={selectedListing.location} />
            <InfoBlock icon="💰" label="Price" value={`₱${Number(selectedListing.price).toLocaleString()}`} />
            {selectedListing.rating > 0 && (
              <InfoBlock icon="⭐" label="Rating" value={`${Number(selectedListing.rating).toFixed(1)} / 5.0`} />
            )}
            {selectedListing.maxGuests && (
              <InfoBlock icon="👥" label="Max Guests" value={selectedListing.maxGuests} />
            )}
          </InfoSection>

          {/* Service Type Specific Information */}
          {serviceType === "experience" && (
            <InfoSection title="Experience Details">
              <InfoBlock icon="👥" label="Max Guests" value={selectedListing.maxGuests} />
              <InfoBlock icon="🏷️" label="Category" value={selectedListing.category} />
              <InfoBlock icon="⏱️" label="Duration" value={selectedListing.duration ? `${selectedListing.duration} hours` : 'N/A'} />
              <InfoBlock icon="👨‍👩‍👧‍👦" label="Group Size Limit" value={selectedListing.groupSizeLimit || selectedListing.groupSize} />
              <InfoBlock icon="📍" label="Meeting Point" value={selectedListing.meetingPoint} />
            </InfoSection>
          )}

          {serviceType === "room" && (
            <InfoSection title="Room Details">
              <InfoBlock icon="🛏️" label="Beds" value={selectedListing.beds} />
              <InfoBlock icon="🛁" label="Bathrooms" value={selectedListing.bathrooms} />
              <InfoBlock icon="🏠" label="Property Type" value={selectedListing.propertyType} />
              <InfoBlock icon="🚪" label="Bedrooms" value={selectedListing.bedrooms} />
              <InfoBlock icon="🏡" label="Room Type" value={selectedListing.roomType} />
            </InfoSection>
          )}

          {serviceType === "service" && (
            <InfoSection title="Service Details">
              <InfoBlock icon="💼" label="Category" value={selectedListing.serviceCategory} />
              <InfoBlock icon="🕒" label="Duration" value={selectedListing.serviceDuration ? `${selectedListing.serviceDuration} hours` : 'N/A'} />
              <InfoBlock icon="⏰" label="Availability Hours" value={selectedListing.availabilityHours} />
              <InfoBlock icon="📍" label="Service Area" value={selectedListing.serviceArea} />
            </InfoSection>
          )}
        </div>

        {/* Amenities */}
        {selectedListing.amenities && selectedListing.amenities.length > 0 && (
          <InfoSection title="Amenities & Features">
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              gridColumn: '1 / -1'
            }}>
              {selectedListing.amenities.map((amenity, index) => (
                <div key={index} style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)'
                }}>
                  {amenity}
                </div>
              ))}
            </div>
          </InfoSection>
        )}
      </div>
      {/* Discount/Promo Section */}
      {selectedListing.discount ? (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          border: '2px solid #fbbf24',
          marginBottom: '32px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: '-50px',
            right: '-50px',
            width: '200px',
            height: '200px',
            background: 'rgba(251, 191, 36, 0.1)',
            borderRadius: '50%'
          }}></div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            position: 'relative',
            zIndex: 1
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
              flex: 1
            }}>
              <div style={{
                background: 'white',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
              }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
                  <path d="m15 9-6 6"/>
                  <path d="M9 9h.01"/>
                  <path d="M15 15h.01"/>
                </svg>
              </div>
              <div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: '#92400e',
                  marginBottom: '8px'
                }}>
                  {selectedListing.discount}% OFF
                </div>
                {selectedListing.promoCode && (
                  <div style={{
                    background: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    display: 'inline-block',
                    marginBottom: '8px',
                    border: '2px dashed #f59e0b'
                  }}>
                    <span style={{
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      marginRight: '8px'
                    }}>Promo Code:</span>
                    <span style={{
                      fontSize: '1.125rem',
                      fontWeight: 700,
                      color: '#92400e',
                      fontFamily: 'monospace',
                      letterSpacing: '2px'
                    }}>
                      {selectedListing.promoCode}
                    </span>
                  </div>
                )}
                {selectedListing.discountStartDate && selectedListing.discountEndDate && (
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#78350f'
                  }}>
                    Valid: {selectedListing.discountStartDate instanceof Date 
                      ? selectedListing.discountStartDate.toLocaleDateString() 
                      : new Date(selectedListing.discountStartDate).toLocaleDateString()} - {selectedListing.discountEndDate instanceof Date 
                      ? selectedListing.discountEndDate.toLocaleDateString() 
                      : new Date(selectedListing.discountEndDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            <button 
              className="changeDiscountButton" 
              onClick={handleDiscount}
              style={{
                background: 'white',
                border: '2px solid #f59e0b',
                color: '#92400e',
                padding: '12px 24px',
                borderRadius: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '0.95rem'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = '#f59e0b'
                e.target.style.color = 'white'
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'white'
                e.target.style.color = '#92400e'
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = 'none'
              }}
            >
              Change Discount
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          marginBottom: '32px',
          textAlign: 'center',
          border: '2px dashed #e5e7eb',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#667eea'
          e.currentTarget.style.background = '#f9fafb'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = '#e5e7eb'
          e.currentTarget.style.background = 'white'
        }}
        >
          <button 
            className="addDiscount" 
            onClick={handleDiscount}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '16px 32px',
              borderRadius: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
            Add Promo/Discount
          </button>
        </div>
      )}
    {/* 🔹 EDIT LISTING DIALOG */}
    <dialog ref={editDialogRef} className="editListing-dialog" style={{
      maxWidth: '900px',
      width: '90%',
      maxHeight: '90vh',
      border: 'none',
      borderRadius: '20px',
      padding: '0',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      background: 'white',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: 'white'
      }}>
        <h2 style={{
          margin: 0,
          fontSize: '1.5rem',
          fontWeight: 700
        }}>
          Edit Listing
        </h2>
        <button
          onClick={closeEditDialog}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '8px',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'white'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)'
            e.target.style.transform = 'rotate(90deg)'
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)'
            e.target.style.transform = 'rotate(0deg)'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{
        padding: '32px',
        maxHeight: 'calc(90vh - 140px)',
        overflowY: 'auto'
      }}>
        {/* 🧾 BASIC INFO */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '32px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Title
            </label>
            <input
              type="text"
              value={generalData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Price (₱)
            </label>
            <input
              type="number"
              value={generalData.price}
              onChange={(e) => handleChange("price", e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Location
            </label>
            <input
              type="text"
              value={generalData.location}
              onChange={(e) => handleChange("location", e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Maximum Guests
            </label>
            <input
              type="number"
              value={generalData.maxGuests}
              onChange={(e) => handleChange("maxGuests", e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Description
            </label>
            <textarea
              value={generalData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              rows="4"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Amenities / What you offer
            </label>
            <input
              type="text"
              value={generalData.amenities.join(", ")}
              placeholder={
                serviceType === "room"
                ? "Ex: TV, WiFi, Air Conditioner"
                : serviceType === "service"
                ? "Ex: Shampoo, Towels, Massage Table"
                : "Ex: Camera, Snacks, Safety Gear"
              }
              onChange={(e) => {
                const amenitiesArray = e.target.value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
                handleChange("amenities", amenitiesArray);
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

        </div>

        {/* Photo Upload Section */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '16px'
          }}>
            Photos
          </h3>
          
          {/* Front Photo */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '12px'
            }}>
              Front Photo (Main Image)
            </label>
            <div
              onClick={() => document.getElementById("photoInput").click()}
              style={{
                width: '100%',
                aspectRatio: '16/9',
                border: '2px dashed #d1d5db',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                overflow: 'hidden',
                background: '#f9fafb',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.background = '#f3f4f6'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#d1d5db'
                e.currentTarget.style.background = '#f9fafb'
              }}
            >
              {photo || selectedListing.photos?.[0] ? (
                <>
                  <img 
                    src={photo || selectedListing.photos?.[0]} 
                    alt="Preview" 
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemovePhoto(e)
                    }} 
                    type="button"
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(0, 0, 0, 0.7)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      fontSize: '18px',
                      fontWeight: 'bold'
                    }}
                  >
                    ✕
                  </button>
                </>
              ) : (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px' }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Click to upload</div>
                </div>
              )}
            </div>
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Additional Photos */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '12px'
            }}>
              Additional Photos (up to 4)
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px'
            }}>
              {Array.from({ length: 4 }).map((_, index) => {
                const existingPhoto = selectedListing.photos?.[index + 1];
                return (
                  <div
                    key={index}
                    onClick={() => document.getElementById(`multiPhoto${index}`).click()}
                    style={{
                      aspectRatio: '1',
                      border: '2px dashed #d1d5db',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      overflow: 'hidden',
                      background: '#f9fafb',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#667eea'
                      e.currentTarget.style.background = '#f3f4f6'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d1d5db'
                      e.currentTarget.style.background = '#f9fafb'
                    }}
                  >
                    {multiPhotos[index] || existingPhoto ? (
                      <>
                        <img
                          src={multiPhotos[index] || existingPhoto}
                          alt={`Photo ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveMultiPhoto(e, index)
                          }}
                          style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}
                        >
                          ✕
                        </button>
                      </>
                    ) : (
                      <div style={{
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '24px'
                      }}>
                        +
                      </div>
                    )}
                    <input
                      id={`multiPhoto${index}`}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleMultiFileChange(e, index)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Service Type Specific Fields */}
        <div style={{
          borderTop: '2px solid #e5e7eb',
          paddingTop: '32px',
          marginTop: '32px'
        }}>
          <h3 style={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#111827',
            marginBottom: '20px'
          }}>
            {serviceType === "room" ? "Room Details" : serviceType === "experience" ? "Experience Details" : "Service Details"}
          </h3>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>

            {serviceType === "room" && (
              <>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Property Type
                  </label>
                  <select
                    value={generalData.propertyType}
                    onChange={(e) => handleChange("propertyType", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  >
                    <option value="">Select Property Type</option>
                    <option value="Apartment">Apartment</option>
                    <option value="Condo">Condo</option>
                    <option value="Villa">Villa</option>
                    <option value="House">House</option>
                    <option value="Studio">Studio</option>
                    <option value="Townhouse">Townhouse</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Bedrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={generalData.bedrooms}
                    onChange={(e) => handleChange("bedrooms", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Beds
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={generalData.beds}
                    onChange={(e) => handleChange("beds", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Bathrooms
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={generalData.bathrooms}
                    onChange={(e) => handleChange("bathrooms", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Room Type
                  </label>
                  <select
                    value={generalData.roomType}
                    onChange={(e) => handleChange("roomType", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box',
                      background: 'white',
                      cursor: 'pointer'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  >
                    <option value="">Select Room Type</option>
                    <option value="entire home">Entire Home</option>
                    <option value="private room">Private Room</option>
                    <option value="shared room">Shared Room</option>
                  </select>
                </div>
              </>
            )}

            {serviceType === "experience" && (
              <>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Category
                  </label>
                  <input
                    type="text"
                    value={generalData.category}
                    onChange={(e) => handleChange("category", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={generalData.duration}
                    onChange={(e) => handleChange("duration", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Group Size Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={generalData.groupSizeLimit}
                    onChange={(e) => handleChange("groupSizeLimit", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Meeting Point
                  </label>
                  <input
                    type="text"
                    value={generalData.meetingPoint}
                    onChange={(e) => handleChange("meetingPoint", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </>
            )}

            {serviceType === "service" && (
              <>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Service Category
                  </label>
                  <input
                    type="text"
                    value={generalData.serviceCategory}
                    onChange={(e) => handleChange("serviceCategory", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Service Duration (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={generalData.serviceDuration}
                    onChange={(e) => handleChange("serviceDuration", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Availability Hours
                  </label>
                  <input
                    type="text"
                    value={generalData.availabilityHours}
                    onChange={(e) => handleChange("availabilityHours", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    Service Area
                  </label>
                  <input
                    type="text"
                    value={generalData.serviceArea}
                    onChange={(e) => handleChange("serviceArea", e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '10px',
                      fontSize: '0.95rem',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#667eea'
                      e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#e5e7eb'
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer with Action Button */}
      <div style={{
        padding: '24px 32px',
        borderTop: '2px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '12px',
        background: '#f9fafb'
      }}>
        <button
          type="button"
          onClick={closeEditDialog}
          style={{
            padding: '12px 24px',
            border: '2px solid #e5e7eb',
            borderRadius: '10px',
            background: 'white',
            color: '#374151',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.95rem'
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#d1d5db'
            e.target.style.background = '#f3f4f6'
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = '#e5e7eb'
            e.target.style.background = 'white'
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={updating}
          style={{
            padding: '12px 32px',
            border: 'none',
            borderRadius: '10px',
            background: updating ? '#9ca3af' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 600,
            cursor: updating ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            fontSize: '0.95rem',
            boxShadow: updating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}
          onMouseEnter={(e) => {
            if (!updating) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!updating) {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
            }
          }}
        >
          {updating ? "Updating..." : "Save Changes"}
        </button>
      </div>

</dialog>

{/* 🔹 CONFIRM UPDATE DIALOG */}
<dialog ref={confirmDialogRef} className="confirmUpdate-dialog">
  <h3>Confirm Update</h3>
  <p>Are you sure you want to update this listing?</p>
  <div className="confirm-buttons">
    <button onClick={confirmUpdate} className="yes-btn">Yes</button>
    <button onClick={() => confirmDialogRef.current?.close()} className="no-btn">No</button>
  </div>
</dialog>




      {/* 🔹 ADD/EDIT DISCOUNT DIALOG */}
      <dialog ref={discountDialogRef} className="addDiscount-dialog">
        <span className="closeButton" onClick={closeDiscountDialog}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </span>

        <h3>{selectedListing?.discount ? "Edit Promo/Discount" : "Add Promo/Discount"}</h3>
        
        <div className="discount-dialog-content">
          <div className="discount-form-group">
            <label className="form-label">
              Discount Percentage (%):
              <input
                className="form-input"
                type="number"
                min="1"
                max="100"
                value={discountData.discount}
                onChange={(e) => handleDiscountChange("discount", e.target.value)}
                placeholder="e.g., 10, 20, 50"
              />
              <small>Enter a value between 1 and 100</small>
            </label>
          </div>

          <div className="discount-form-group">
            <label className="form-label">
              Promo Code (Optional):
              <input
                className="form-input"
                type="text"
                value={discountData.promoCode}
                onChange={(e) => handleDiscountChange("promoCode", e.target.value.toUpperCase())}
                placeholder="e.g., SAVE10, SUMMER20"
                maxLength="20"
              />
              <small>Leave empty if you want to apply discount automatically</small>
            </label>
          </div>

          <div className="discount-form-group">
            <label className="form-label">
              Start Date (Optional):
              <input
                className="form-input"
                type="date"
                value={discountData.startDate}
                onChange={(e) => handleDiscountChange("startDate", e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <small>When the discount should start</small>
            </label>
          </div>

          <div className="discount-form-group">
            <label className="form-label">
              End Date (Optional):
              <input
                className="form-input"
                type="date"
                value={discountData.endDate}
                onChange={(e) => handleDiscountChange("endDate", e.target.value)}
                min={discountData.startDate || new Date().toISOString().split('T')[0]}
              />
              <small>When the discount should end</small>
            </label>
          </div>

          <div className="discount-form-group">
            <label className="form-label">
              Description (Optional):
              <textarea
                className="form-input"
                value={discountData.description}
                onChange={(e) => handleDiscountChange("description", e.target.value)}
                placeholder="e.g., Summer special discount, First-time customer offer"
                rows="3"
                maxLength="200"
              />
              <small>{discountData.description.length}/200 characters</small>
            </label>
          </div>

          <div className="discount-preview">
            <h4>Preview:</h4>
            <div className="preview-card">
              <p><strong>Discount: {discountData.discount || 0}%</strong></p>
              {discountData.promoCode && <p>Promo Code: <strong>{discountData.promoCode}</strong></p>}
              {discountData.startDate && discountData.endDate && (
                <p>Valid: {new Date(discountData.startDate).toLocaleDateString()} - {new Date(discountData.endDate).toLocaleDateString()}</p>
              )}
              {discountData.description && <p className="preview-description">{discountData.description}</p>}
              {selectedListing?.price && discountData.discount > 0 && (
                <p className="preview-price">
                  Original: ₱{selectedListing.price} → Discounted: ₱{Math.round(selectedListing.price * (1 - discountData.discount / 100))}
                </p>
              )}
            </div>
          </div>

          <div className="discount-dialog-buttons">
            <button
              className="save-discount-btn"
              onClick={handleSaveDiscount}
              disabled={savingDiscount || !discountData.discount || discountData.discount <= 0 || discountData.discount > 100}
            >
              {savingDiscount ? "Saving..." : selectedListing?.discount ? "Update Discount" : "Save Discount"}
            </button>
            
            {selectedListing?.discount && (
              <button
                className="remove-discount-btn"
                onClick={handleRemoveDiscount}
                disabled={savingDiscount}
              >
                Remove Discount
              </button>
            )}
            
            <button
              className="cancel-discount-btn"
              onClick={closeDiscountDialog}
              disabled={savingDiscount}
            >
              Cancel
            </button>
          </div>
        </div>
      </dialog>
      </div>
    </>
  );
};

export default ViewListing;
