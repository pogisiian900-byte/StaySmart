import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const TIER_LEVELS = [
  { id: "member", label: "Member", minPoints: 0, multiplier: 1 },
  { id: "silver", label: "Silver Host", minPoints: 1000, multiplier: 1.1 },
  { id: "gold", label: "Gold Host", minPoints: 5000, multiplier: 1.25 },
  { id: "platinum", label: "Platinum Host", minPoints: 15000, multiplier: 1.5 },
];


const Points = ({ hostId }) => {
  const [pointsData, setPointsData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null); // Separate error for history
  
  // Conversion states
  const [conversionAmount, setConversionAmount] = useState("");
  const [converting, setConverting] = useState(false);
  const [conversionError, setConversionError] = useState(null);
  const [conversionSuccess, setConversionSuccess] = useState(null);
  
  // Conversion rate: 1 point = 1 peso (you can adjust this)
  const CONVERSION_RATE = 1; // 1 point = 1 peso

  useEffect(() => {
    if (!hostId) return;

    const userRef = doc(db, "Users", hostId);
    const unsub = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setPointsData(null);
        } else {
          setPointsData(snap.data());
        }
        setLoadingAccount(false);
      },
      (err) => {
        console.error("Failed to load points:", err);
        setError("We couldn't load your points right now. Please try again later.");
        setLoadingAccount(false);
      }
    );

    return () => unsub();
  }, [hostId]);

  useEffect(() => {
    if (!hostId) return;

    try {
      // Query for both userId and hostId to handle both cases
      const q = query(
        collection(db, "PointsTransactions"),
        where("userId", "==", hostId),
        orderBy("createdAt", "desc"),
        limit(25)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const list = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setHistory(list);
          setLoadingHistory(false);
          setHistoryError(null); // Clear any previous errors
        },
        (err) => {
          console.error("Failed to load points history:", err);
          // Don't set main error - history is optional
          setHistoryError("Unable to load transaction history");
          setHistory([]); // Set empty array on error
          setLoadingHistory(false);
        }
      );

      return () => unsub();
    } catch (err) {
      // Covers cases where the collection/index might not exist yet
      console.warn("Points history unavailable:", err);
      setHistory([]);
      setHistoryError("Transaction history unavailable");
      setLoadingHistory(false);
    }
  }, [hostId]);

  const computedPoints = useMemo(() => {
    const currentPoints =
      Number(pointsData?.loyaltyPoints ?? pointsData?.points ?? 0) || 0;
    const lifetimePoints =
      Number(pointsData?.lifetimeLoyaltyPoints ?? pointsData?.lifetimePoints ?? currentPoints) ||
      0;

    const tier =
      [...TIER_LEVELS].reverse().find((level) => currentPoints >= level.minPoints) ||
      TIER_LEVELS[0];

    const tierIndex = TIER_LEVELS.findIndex((level) => level.id === tier.id);
    const nextTier = tierIndex + 1 < TIER_LEVELS.length ? TIER_LEVELS[tierIndex + 1] : null;

    const progressToNext = nextTier
      ? Math.min(
          100,
          ((currentPoints - tier.minPoints) /
            Math.max(nextTier.minPoints - tier.minPoints, 1)) *
            100
        )
      : 100;

    return {
      currentPoints,
      lifetimePoints,
      tier,
      nextTier,
      progressToNext,
    };
  }, [pointsData]);

  // Calculate cash value from points
  const calculateCashValue = (points) => {
    return (points * CONVERSION_RATE).toFixed(2);
  };

  // Handle points to cash conversion
  const handleConvertPoints = async () => {
    if (!hostId) {
      setConversionError("User ID not found");
      return;
    }

    const pointsToConvert = parseFloat(conversionAmount);
    
    // Validation
    if (!conversionAmount || isNaN(pointsToConvert) || pointsToConvert <= 0) {
      setConversionError("Please enter a valid amount of points");
      return;
    }

    if (pointsToConvert > computedPoints.currentPoints) {
      setConversionError(`You only have ${computedPoints.currentPoints.toFixed(2)} points available`);
      return;
    }

    // Minimum conversion (optional - you can remove this)
    if (pointsToConvert < 1) {
      setConversionError("Minimum conversion is 1 point");
      return;
    }

    setConverting(true);
    setConversionError(null);
    setConversionSuccess(null);

    try {
      const userRef = doc(db, "Users", hostId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setConversionError("User account not found");
        setConverting(false);
        return;
      }

      const userData = userSnap.data();
      const currentPoints = userData.loyaltyPoints || userData.points || 0;
      const currentBalance = userData.balance || userData.walletBalance || 0;

      // Double-check points availability
      if (pointsToConvert > currentPoints) {
        setConversionError(`Insufficient points. You have ${currentPoints.toFixed(2)} points available`);
        setConverting(false);
        return;
      }

      // Calculate cash amount
      const cashAmount = pointsToConvert * CONVERSION_RATE;
      const newPoints = currentPoints - pointsToConvert;
      const newBalance = currentBalance + cashAmount;

      // Update user document
      await updateDoc(userRef, {
        loyaltyPoints: newPoints,
        balance: newBalance,
        updatedAt: serverTimestamp(),
      });

      // Create points transaction (deduction)
      const pointsTransaction = {
        userId: hostId,
        hostId: hostId,
        points: -pointsToConvert,
        title: "Points to Cash Conversion",
        reason: `Converted ${pointsToConvert.toFixed(2)} points to ₱${cashAmount.toFixed(2)}`,
        type: "points_conversion",
        cashAmount: cashAmount,
        conversionRate: CONVERSION_RATE,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "PointsTransactions"), pointsTransaction);

      // Create balance transaction (addition)
      const balanceTransaction = {
        userId: hostId,
        hostId: hostId,
        amount: cashAmount,
        type: "points_conversion",
        description: `Converted ${pointsToConvert.toFixed(2)} points to cash`,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        pointsConverted: pointsToConvert,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, "Transactions"), balanceTransaction);

      // Create notification
      await addDoc(collection(db, "Notifications"), {
        type: "points_converted",
        recipientId: hostId,
        hostId: hostId,
        title: "Points Converted",
        body: `Successfully converted ${pointsToConvert.toFixed(2)} points to ₱${cashAmount.toFixed(2)}`,
        message: `Successfully converted ${pointsToConvert.toFixed(2)} points to ₱${cashAmount.toFixed(2)}`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setConversionSuccess(
        `Successfully converted ${pointsToConvert.toFixed(2)} points to ₱${cashAmount.toFixed(2)}`
      );
      setConversionAmount("");
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setConversionSuccess(null);
      }, 5000);

    } catch (err) {
      console.error("Error converting points:", err);
      setConversionError("Failed to convert points. Please try again later.");
    } finally {
      setConverting(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "—";
    if (value.toDate) return value.toDate().toLocaleString();
    if (value.toMillis) return new Date(value.toMillis()).toLocaleString();
    if (typeof value === "number") return new Date(value).toLocaleString();
    return new Date(value).toLocaleString();
  };

  return (
    <div className="host-points-page">
      <header className="host-points-header">
        <h1>Loyalty Points</h1>
        <p>Track the rewards you earn from successful stays and unlock host perks.</p>
      </header>

      {/* Only show main error for account loading issues */}
      {error && (
        <div className="host-points-alert">
          <p>{error}</p>
        </div>
      )}

      <section className="host-points-summary">
        <div className="host-points-card highlight">
          <span className="label">Current balance</span>
          <span className="value">{loadingAccount ? "—" : computedPoints.currentPoints.toLocaleString()}</span>
        </div>
        <div className="host-points-card">
          <span className="label">Lifetime points</span>
          <span className="value">
            {loadingAccount ? "—" : computedPoints.lifetimePoints.toLocaleString()}
          </span>
        </div>
        <div className="host-points-card">
          <span className="label">Tier</span>
          <span className="value">
            {loadingAccount ? "—" : computedPoints.tier.label}
          </span>
          <p className="helper">
            {loadingAccount
              ? "Calculating perks…"
              : `x${computedPoints.tier.multiplier.toFixed(2)} booking multiplier`}
          </p>
        </div>
        <div className="host-points-card">
          <span className="label">Next milestone</span>
          <span className="value">
            {loadingAccount
              ? "—"
              : computedPoints.nextTier
              ? `${computedPoints.nextTier.label}`
              : "Max tier reached"}
          </span>
          {!loadingAccount && computedPoints.nextTier && (
            <p className="helper">
              {`${Math.max(
                computedPoints.nextTier.minPoints - computedPoints.currentPoints,
                0
              ).toLocaleString()} pts to go`}
            </p>
          )}
        </div>
      </section>

      <section className="host-points-progress">
        <div className="progress-header">
          <h2>Your progress</h2>
          {!loadingAccount && computedPoints.nextTier && (
            <span>
              {computedPoints.progressToNext.toFixed(0)}% towards {computedPoints.nextTier.label}
            </span>
          )}
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${computedPoints.progressToNext}%` }}
          />
        </div>
      </section>

      {/* Points to Cash Conversion Section */}
      <section className="host-points-conversion" style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '20px',
        padding: '32px',
        boxShadow: '0 4px 20px rgba(49, 50, 111, 0.08), 0 0 0 1px rgba(49, 50, 111, 0.05)',
        border: '1px solid rgba(49, 50, 111, 0.1)',
        marginBottom: '32px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background element */}
        <div style={{
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '200px',
          height: '200px',
          background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.05) 0%, rgba(49, 50, 111, 0.02) 100%)',
          borderRadius: '50%',
          zIndex: 0
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '8px' 
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #31326f, #4a4d8c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 12px rgba(49, 50, 111, 0.3)'
            }}>
              💰
            </div>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#1f2937',
                letterSpacing: '-0.02em'
              }}>
                Convert Points to Cash
              </h2>
              <p style={{ 
                margin: '4px 0 0', 
                color: '#6b7280', 
                fontSize: '0.9rem' 
              }}>
                Instant conversion • {CONVERSION_RATE} point = ₱{CONVERSION_RATE}
              </p>
            </div>
          </div>

          {conversionSuccess && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.1), rgba(49, 50, 111, 0.05))',
              border: '2px solid rgba(49, 50, 111, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '20px',
              marginBottom: '20px',
              color: '#31326f',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(49, 50, 111, 0.1)'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <span>{conversionSuccess}</span>
            </div>
          )}

          {conversionError && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '20px',
              marginBottom: '20px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
            }}>
              <span style={{ fontSize: '20px' }}>⚠</span>
              <span>{conversionError}</span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '24px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '20px',
              border: '2px solid rgba(49, 50, 111, 0.1)',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(49, 50, 111, 0.05)'
            }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontWeight: '600',
                color: '#374151',
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Points to Convert
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="1"
                  max={computedPoints.currentPoints}
                  step="0.01"
                  value={conversionAmount}
                  onChange={(e) => {
                    setConversionAmount(e.target.value);
                    setConversionError(null);
                    setConversionSuccess(null);
                  }}
                  placeholder="0.00"
                  disabled={converting || loadingAccount}
                  style={{
                    width: '100%',
                    padding: '16px 16px 16px 48px',
                    borderRadius: '12px',
                    border: '2px solid rgba(49, 50, 111, 0.15)',
                    fontSize: '1.25rem',
                    fontWeight: '600',
                    outline: 'none',
                    transition: 'all 0.2s',
                    background: '#f9fafb',
                    color: '#1f2937'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#31326f';
                    e.target.style.background = 'white';
                    e.target.style.boxShadow = '0 0 0 4px rgba(49, 50, 111, 0.1)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(49, 50, 111, 0.15)';
                    e.target.style.background = '#f9fafb';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <span style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#6b7280'
                }}>⭐</span>
              </div>
              <p style={{
                marginTop: '8px',
                fontSize: '0.8rem',
                color: '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>Available:</span>
                <span style={{ fontWeight: '600', color: '#31326f' }}>
                  {loadingAccount ? "—" : computedPoints.currentPoints.toFixed(2)} pts
                </span>
              </p>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.05), rgba(49, 50, 111, 0.02))',
              borderRadius: '16px',
              padding: '20px',
              border: '2px solid rgba(49, 50, 111, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}>
              <label style={{
                display: 'block',
                marginBottom: '12px',
                fontWeight: '600',
                color: '#374151',
                fontSize: '0.9rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Cash Value
              </label>
              <div style={{
                fontSize: '1.75rem',
                fontWeight: '700',
                color: '#31326f',
                display: 'flex',
                alignItems: 'baseline',
                gap: '4px'
              }}>
                <span style={{ fontSize: '1.25rem', color: '#6b7280' }}>₱</span>
                <span>
                  {conversionAmount && !isNaN(parseFloat(conversionAmount)) 
                    ? parseFloat(calculateCashValue(parseFloat(conversionAmount))).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    : '0.00'}
                </span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end'
            }}>
              <button
                type="button"
                onClick={handleConvertPoints}
                disabled={converting || loadingAccount || !conversionAmount || parseFloat(conversionAmount) <= 0}
                style={{
                  width: '100%',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  background: converting || loadingAccount || !conversionAmount || parseFloat(conversionAmount) <= 0
                    ? 'linear-gradient(135deg, #d1d5db, #e5e7eb)'
                    : 'linear-gradient(135deg, #31326f, #4a4d8c)',
                  color: 'white',
                  border: 'none',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: converting || loadingAccount || !conversionAmount || parseFloat(conversionAmount) <= 0
                    ? 'not-allowed'
                    : 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: converting || loadingAccount || !conversionAmount || parseFloat(conversionAmount) <= 0
                    ? 'none'
                    : '0 4px 16px rgba(49, 50, 111, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  if (!converting && !loadingAccount && conversionAmount && parseFloat(conversionAmount) > 0) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(49, 50, 111, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0)';
                  if (!converting && !loadingAccount && conversionAmount && parseFloat(conversionAmount) > 0) {
                    e.target.style.boxShadow = '0 4px 16px rgba(49, 50, 111, 0.3)';
                  }
                }}
              >
                {converting ? (
                  <>
                    <span style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid white',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      display: 'inline-block'
                    }} />
                    Converting...
                  </>
                ) : (
                  <>
                    <span>💸</span>
                    Convert Now
                  </>
                )}
              </button>
            </div>
          </div>

          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(49, 50, 111, 0.03)',
            borderRadius: '12px',
            border: '1px solid rgba(49, 50, 111, 0.08)',
            fontSize: '0.85rem',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            <span>
              <strong style={{ color: '#374151' }}>Instant conversion:</strong> Cash is added to your account balance immediately. No waiting time.
            </span>
          </div>
        </div>
      </section>

      <section className="host-points-actions" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <div className="action-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(49, 50, 111, 0.08), 0 0 0 1px rgba(49, 50, 111, 0.05)',
          border: '1px solid rgba(49, 50, 111, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(49, 50, 111, 0.12), 0 0 0 1px rgba(49, 50, 111, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(49, 50, 111, 0.08), 0 0 0 1px rgba(49, 50, 111, 0.05)';
        }}
        >
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(251, 191, 36, 0.05))',
            borderRadius: '50%',
            zIndex: 0
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '20px',
              boxShadow: '0 4px 16px rgba(251, 191, 36, 0.3)'
            }}>
              ⭐
            </div>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937',
              letterSpacing: '-0.02em'
            }}>
              Earn More Points
            </h3>
            <p style={{
              margin: '0 0 24px',
              color: '#6b7280',
              lineHeight: '1.6',
              fontSize: '0.95rem'
            }}>
              Maximize your rewards by confirming bookings quickly and maintaining high guest satisfaction ratings.
            </p>
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(251, 191, 36, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(251, 191, 36, 0.15)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                  Quick Response Bonus
                </span>
                <span style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: '700' }}>
                  +80 pts
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '8px'
              }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                  5-Star Review
                </span>
                <span style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: '700' }}>
                  +150 pts
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                  Per Booking
                </span>
                <span style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: '700' }}>
                  0.1% of earnings
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window?.scrollTo?.({ top: 0, behavior: "smooth" })}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #31326f, #4a4d8c)',
                color: 'white',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(49, 50, 111, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(49, 50, 111, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.2)';
              }}
            >
              <span>📈</span>
              View Earning Tips
            </button>
          </div>
        </div>

        <div className="action-card" style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 4px 20px rgba(49, 50, 111, 0.08), 0 0 0 1px rgba(49, 50, 111, 0.05)',
          border: '1px solid rgba(49, 50, 111, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          opacity: 0.7
        }}>
          <div style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '120px',
            height: '120px',
            background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.1), rgba(49, 50, 111, 0.05))',
            borderRadius: '50%',
            zIndex: 0
          }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '20px',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.3)'
            }}>
              🎁
            </div>
            <h3 style={{
              margin: '0 0 12px',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1f2937',
              letterSpacing: '-0.02em'
            }}>
              Redeem Perks
            </h3>
            <p style={{
              margin: '0 0 24px',
              color: '#6b7280',
              lineHeight: '1.6',
              fontSize: '0.95rem'
            }}>
              Unlock exclusive benefits, promotional boosts, and premium features with your loyalty points.
            </p>
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              background: 'rgba(99, 102, 241, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              textAlign: 'center'
            }}>
              <span style={{
                fontSize: '0.9rem',
                color: '#6366f1',
                fontWeight: '600'
              }}>
                Coming Soon
              </span>
            </div>
            <button 
              type="button" 
              disabled
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #d1d5db, #e5e7eb)',
                color: '#9ca3af',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>🔒</span>
              Unlock Soon
            </button>
          </div>
        </div>
      </section>

      <section className="host-points-history">
        <div className="history-header">
          <h2>Recent activity</h2>
          {!loadingHistory && history.length > 0 && (
            <span>{history.length} most recent transactions</span>
          )}
        </div>

        {historyError && (
          <div className="history-empty" style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            <p>{historyError}</p>
          </div>
        )}

        {loadingHistory ? (
          <div className="history-empty">
            <p>Loading your latest rewards…</p>
          </div>
        ) : history.length === 0 && !historyError ? (
          <div className="history-empty">
            <p>No activity yet. Complete bookings to earn your first points.</p>
          </div>
        ) : history.length > 0 ? (
          <ul className="history-list">
            {history.map((entry) => {
              const amount = Number(entry.points ?? entry.amount ?? 0);
              const formattedAmount = `${amount >= 0 ? "+" : ""}${amount.toLocaleString()} pts`;
              return (
                <li key={entry.id} className="history-item">
                  <div className="history-details">
                    <span className="history-title">
                      {entry.title || entry.reason || "Points adjustment"}
                    </span>
                    <span className="history-date">{formatDate(entry.createdAt)}</span>
                  </div>
                  <span className={`history-amount ${amount >= 0 ? "positive" : "negative"}`}>
                    {formattedAmount}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
};

export default Points;

