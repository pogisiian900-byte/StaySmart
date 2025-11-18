import { useEffect, useMemo, useState, useRef } from "react";
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
  Timestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';

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
  
  // Redemption states (replacing conversion)
  const [selectedCashAmount, setSelectedCashAmount] = useState(null);
  const [redeemingCash, setRedeemingCash] = useState(false);
  const [redemptionCashError, setRedemptionCashError] = useState(null);
  const [redemptionCashSuccess, setRedemptionCashSuccess] = useState(null);
  const [showCashRedemptionDialog, setShowCashRedemptionDialog] = useState(false);
  const cashRedemptionDialogRef = useRef(null);
  
  // Reward redemption states
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redemptionError, setRedemptionError] = useState(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState(null);
  const [showRewardDialog, setShowRewardDialog] = useState(false);
  const rewardDialogRef = useRef(null);
  
  // Conversion rate: 50 points = 1 peso (1 point = 0.02 pesos)
  const CONVERSION_RATE = 0.02; // 50 points per 1 peso

  // Pre-converted cash redemption options
  const CASH_REDEMPTION_OPTIONS = [
    { cashAmount: 10, pointsRequired: 500, label: '₱10' },
    { cashAmount: 50, pointsRequired: 2500, label: '₱50' },
    { cashAmount: 100, pointsRequired: 5000, label: '₱100' }
  ];

  // Available rewards
  const AVAILABLE_REWARDS = [
    {
      id: 'featured_listing_7d',
      name: 'Featured Listing (7 Days)',
      description: 'Boost your listing visibility for 7 days. Your listing will appear at the top of search results.',
      cost: 500,
      icon: '⭐',
      category: 'promotion'
    },
    {
      id: 'featured_listing_30d',
      name: 'Featured Listing (30 Days)',
      description: 'Boost your listing visibility for 30 days. Maximum exposure for your property.',
      cost: 2000,
      icon: '🌟',
      category: 'promotion'
    },
    {
      id: 'premium_badge',
      name: 'Premium Host Badge',
      description: 'Display a premium badge on your profile and listings for 90 days. Increases trust and bookings.',
      cost: 1500,
      icon: '👑',
      category: 'badge'
    },
    {
      id: 'service_fee_discount_10',
      name: '10% Service Fee Discount',
      description: 'Get 10% off service fees on your next 5 bookings. Valid for 60 days.',
      cost: 1000,
      icon: '💸',
      category: 'discount'
    },
    {
      id: 'priority_support',
      name: 'Priority Support Access',
      description: 'Get priority customer support for 30 days. Faster response times and dedicated assistance.',
      cost: 800,
      icon: '🎯',
      category: 'support'
    },
    {
      id: 'analytics_boost',
      name: 'Advanced Analytics Access',
      description: 'Unlock advanced analytics and insights for your listings for 90 days.',
      cost: 1200,
      icon: '📊',
      category: 'feature'
    }
  ];

  // Register dialog polyfill
  useEffect(() => {
    if (cashRedemptionDialogRef.current && !cashRedemptionDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(cashRedemptionDialogRef.current);
    }
  }, [showCashRedemptionDialog]);

  useEffect(() => {
    if (rewardDialogRef.current && !rewardDialogRef.current.showModal) {
      dialogPolyfill.registerDialog(rewardDialogRef.current);
    }
  }, [showRewardDialog]);

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

  // Show cash redemption confirmation dialog
  const handleShowCashRedemptionDialog = (option) => {
    if (!hostId) {
      setRedemptionCashError("User ID not found");
      return;
    }

    if (!option) {
      setRedemptionCashError("Please select a cash amount");
      return;
    }

    // Check if user has enough points
    if (computedPoints.currentPoints < option.pointsRequired) {
      setRedemptionCashError(`You need ${option.pointsRequired.toLocaleString()} points to redeem ₱${option.cashAmount}. You currently have ${computedPoints.currentPoints.toLocaleString()} points.`);
      return;
    }

    setSelectedCashAmount(option);
    setRedemptionCashError(null);
    setShowCashRedemptionDialog(true);
    if (cashRedemptionDialogRef.current) {
      try {
        if (typeof cashRedemptionDialogRef.current.showModal === 'function') {
          cashRedemptionDialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(cashRedemptionDialogRef.current);
          cashRedemptionDialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing cash redemption dialog:', err);
        cashRedemptionDialogRef.current.style.display = 'block';
      }
    }
  };

  // Close cash redemption dialog
  const handleCloseCashRedemptionDialog = () => {
    setShowCashRedemptionDialog(false);
    setSelectedCashAmount(null);
    cashRedemptionDialogRef.current?.close();
  };

  // Handle cash redemption (after confirmation)
  const handleRedeemCash = async () => {
    if (!selectedCashAmount) {
      setRedemptionCashError("No cash amount selected");
      return;
    }

    handleCloseCashRedemptionDialog();
    
    setRedeemingCash(true);
    setRedemptionCashError(null);
    setRedemptionCashSuccess(null);

    try {
      const userRef = doc(db, "Users", hostId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setRedemptionCashError("User account not found");
        setRedeemingCash(false);
        return;
      }

      const userData = userSnap.data();
      const currentPoints = userData.loyaltyPoints || userData.points || 0;
      const currentBalance = userData.balance || userData.walletBalance || 0;

      // Double-check points availability
      if (currentPoints < selectedCashAmount.pointsRequired) {
        setRedemptionCashError(`Insufficient points. You have ${currentPoints.toLocaleString()} points, but need ${selectedCashAmount.pointsRequired.toLocaleString()} points.`);
        setRedeemingCash(false);
        return;
      }

      // Calculate new balances
      const newPoints = currentPoints - selectedCashAmount.pointsRequired;
      const newBalance = currentBalance + selectedCashAmount.cashAmount;

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
        points: -selectedCashAmount.pointsRequired,
        title: "Cash Redemption",
        reason: `Redeemed ₱${selectedCashAmount.cashAmount} for ${selectedCashAmount.pointsRequired.toLocaleString()} points`,
        type: "cash_redemption",
        cashAmount: selectedCashAmount.cashAmount,
        pointsUsed: selectedCashAmount.pointsRequired,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "PointsTransactions"), pointsTransaction);

      // Create balance transaction (addition)
      const balanceTransaction = {
        userId: hostId,
        hostId: hostId,
        amount: selectedCashAmount.cashAmount,
        type: "cash_redemption",
        description: `Redeemed ₱${selectedCashAmount.cashAmount} from points`,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        pointsRedeemed: selectedCashAmount.pointsRequired,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, "Transactions"), balanceTransaction);

      // Create notification
      await addDoc(collection(db, "Notifications"), {
        type: "cash_redeemed",
        recipientId: hostId,
        hostId: hostId,
        title: "Cash Redeemed",
        body: `Successfully redeemed ₱${selectedCashAmount.cashAmount} from ${selectedCashAmount.pointsRequired.toLocaleString()} points`,
        message: `Successfully redeemed ₱${selectedCashAmount.cashAmount} from ${selectedCashAmount.pointsRequired.toLocaleString()} points`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setRedemptionCashSuccess(
        `Successfully redeemed ₱${selectedCashAmount.cashAmount}! Cash has been added to your account balance.`
      );
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setRedemptionCashSuccess(null);
      }, 5000);

    } catch (err) {
      console.error("Error redeeming cash:", err);
      setRedemptionCashError("Failed to redeem cash. Please try again later.");
    } finally {
      setRedeemingCash(false);
    }
  };

  // Show reward selection dialog
  const handleShowRewardDialog = (reward) => {
    if (!hostId) {
      setRedemptionError("User ID not found");
      return;
    }

    if (!reward) {
      setRedemptionError("Please select a reward");
      return;
    }

    // Check if user has enough points
    if (computedPoints.currentPoints < reward.cost) {
      setRedemptionError(`You need ${reward.cost} points to redeem this reward. You currently have ${computedPoints.currentPoints.toFixed(2)} points.`);
      return;
    }

    setSelectedReward(reward);
    setRedemptionError(null);
    setShowRewardDialog(true);
    if (rewardDialogRef.current) {
      try {
        if (typeof rewardDialogRef.current.showModal === 'function') {
          rewardDialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(rewardDialogRef.current);
          rewardDialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing reward dialog:', err);
        rewardDialogRef.current.style.display = 'block';
      }
    }
  };

  // Close reward dialog
  const handleCloseRewardDialog = () => {
    setShowRewardDialog(false);
    setSelectedReward(null);
    rewardDialogRef.current?.close();
  };

  // Handle reward redemption (after confirmation)
  const handleRedeemReward = async () => {
    if (!selectedReward) {
      setRedemptionError("No reward selected");
      return;
    }

    handleCloseRewardDialog();
    
    setRedeeming(true);
    setRedemptionError(null);
    setRedemptionSuccess(null);

    try {
      const userRef = doc(db, "Users", hostId);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setRedemptionError("User account not found");
        setRedeeming(false);
        return;
      }

      const userData = userSnap.data();
      const currentPoints = userData.loyaltyPoints || userData.points || 0;

      // Double-check points availability
      if (currentPoints < selectedReward.cost) {
        setRedemptionError(`Insufficient points. You have ${currentPoints.toFixed(2)} points, but need ${selectedReward.cost} points.`);
        setRedeeming(false);
        return;
      }

      // Calculate new points balance
      const newPoints = currentPoints - selectedReward.cost;

      // Update user document
      await updateDoc(userRef, {
        loyaltyPoints: newPoints,
        updatedAt: serverTimestamp(),
      });

      // Calculate expiration date based on reward type
      const expirationDate = new Date();
      let expiresAt = null;
      
      if (selectedReward.id.includes('7d')) {
        expirationDate.setDate(expirationDate.getDate() + 7);
        expiresAt = Timestamp.fromDate(expirationDate);
      } else if (selectedReward.id.includes('30d')) {
        expirationDate.setDate(expirationDate.getDate() + 30);
        expiresAt = Timestamp.fromDate(expirationDate);
      } else if (selectedReward.id.includes('90d') || selectedReward.id === 'premium_badge' || selectedReward.id === 'analytics_boost') {
        expirationDate.setDate(expirationDate.getDate() + 90);
        expiresAt = Timestamp.fromDate(expirationDate);
      } else if (selectedReward.id === 'service_fee_discount_10') {
        expirationDate.setDate(expirationDate.getDate() + 60);
        expiresAt = Timestamp.fromDate(expirationDate);
      } else if (selectedReward.id === 'priority_support') {
        expirationDate.setDate(expirationDate.getDate() + 30);
        expiresAt = Timestamp.fromDate(expirationDate);
      }

      // Create redeemed reward record
      const redeemedReward = {
        userId: hostId,
        hostId: hostId,
        rewardId: selectedReward.id,
        rewardName: selectedReward.name,
        rewardDescription: selectedReward.description,
        rewardCategory: selectedReward.category,
        rewardIcon: selectedReward.icon,
        pointsCost: selectedReward.cost,
        status: 'active',
        redeemedAt: serverTimestamp(),
        expiresAt: expiresAt,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "RedeemedRewards"), redeemedReward);

      // Create points transaction (deduction)
      const pointsTransaction = {
        userId: hostId,
        hostId: hostId,
        points: -selectedReward.cost,
        title: "Reward Redemption",
        reason: `Redeemed ${selectedReward.name} for ${selectedReward.cost} points`,
        type: "reward_redemption",
        rewardId: selectedReward.id,
        rewardName: selectedReward.name,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "PointsTransactions"), pointsTransaction);

      // Create notification
      let expirationDateStr = null;
      if (expiresAt) {
        if (expiresAt.toDate) {
          expirationDateStr = expiresAt.toDate().toLocaleDateString();
        } else if (expiresAt.toMillis) {
          expirationDateStr = new Date(expiresAt.toMillis()).toLocaleDateString();
        }
      }
      await addDoc(collection(db, "Notifications"), {
        type: "reward_redeemed",
        recipientId: hostId,
        hostId: hostId,
        title: "Reward Redeemed",
        body: `Successfully redeemed ${selectedReward.name} for ${selectedReward.cost} points`,
        message: `Your reward "${selectedReward.name}" is now active${expirationDateStr ? ` and will expire on ${expirationDateStr}` : ''}.`,
        read: false,
        createdAt: serverTimestamp(),
      });

      setRedemptionSuccess(
        `Successfully redeemed ${selectedReward.name}! Your reward is now active.`
      );
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setRedemptionSuccess(null);
      }, 5000);

    } catch (err) {
      console.error("Error redeeming reward:", err);
      setRedemptionError("Failed to redeem reward. Please try again later.");
    } finally {
      setRedeeming(false);
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

      {/* Cash Redemption Section */}
      <section className="host-points-redemption" style={{
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
                Redeem Points for Cash
              </h2>
              <p style={{ 
                margin: '4px 0 0', 
                color: '#6b7280', 
                fontSize: '0.9rem' 
              }}>
                Instant redemption • 50 points = ₱1
              </p>
            </div>
          </div>

          {redemptionCashSuccess && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '20px',
              marginBottom: '20px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <span>{redemptionCashSuccess}</span>
            </div>
          )}

          {redemptionCashError && (
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
              <span>{redemptionCashError}</span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '20px',
            marginTop: '24px'
          }}>
            {CASH_REDEMPTION_OPTIONS.map((option) => {
              const canAfford = computedPoints.currentPoints >= option.pointsRequired;
              return (
                <button
                  key={option.cashAmount}
                  type="button"
                  onClick={() => handleShowCashRedemptionDialog(option)}
                  disabled={!canAfford || redeemingCash || loadingAccount}
                  style={{
                    background: canAfford && !redeemingCash && !loadingAccount
                      ? 'linear-gradient(135deg, #ffffff, #f8fafc)'
                      : 'linear-gradient(135deg, #f3f4f6, #e5e7eb)',
                    borderRadius: '16px',
                    padding: '24px',
                    border: `2px solid ${canAfford && !redeemingCash && !loadingAccount ? 'rgba(49, 50, 111, 0.2)' : 'rgba(209, 213, 219, 0.5)'}`,
                    transition: 'all 0.3s ease',
                    boxShadow: canAfford && !redeemingCash && !loadingAccount
                      ? '0 4px 12px rgba(49, 50, 111, 0.15)'
                      : 'none',
                    cursor: canAfford && !redeemingCash && !loadingAccount ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (canAfford && !redeemingCash && !loadingAccount) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(49, 50, 111, 0.25)';
                      e.currentTarget.style.borderColor = 'rgba(49, 50, 111, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    if (canAfford && !redeemingCash && !loadingAccount) {
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(49, 50, 111, 0.2)';
                    }
                  }}
                >
                  <div style={{
                    fontSize: '2.5rem',
                    fontWeight: '700',
                    color: canAfford && !redeemingCash && !loadingAccount ? '#31326f' : '#9ca3af',
                    marginBottom: '12px'
                  }}>
                    {option.label}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#6b7280',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span>⭐</span>
                    <span>{option.pointsRequired.toLocaleString()} points</span>
                  </div>
                  {!canAfford && (
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#ef4444',
                      fontWeight: '600',
                      padding: '4px 12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '8px'
                    }}>
                      Insufficient Points
                    </div>
                  )}
                </button>
              );
            })}
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
              <strong style={{ color: '#374151' }}>Available points:</strong> {loadingAccount ? "—" : computedPoints.currentPoints.toLocaleString()} pts • 
              <strong style={{ color: '#374151', marginLeft: '8px' }}>Instant redemption:</strong> Cash is added to your account balance immediately.
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
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))',
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
            <button
              type="button"
              onClick={() => {
                const rewardsSection = document.getElementById('rewards-section');
                if (rewardsSection) {
                  rewardsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              style={{
                width: '100%',
                padding: '14px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                border: 'none',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.2)';
              }}
            >
              <span>🎁</span>
              Browse Rewards
            </button>
          </div>
        </div>
      </section>

      {/* Rewards Redemption Section */}
      <section id="rewards-section" className="host-points-rewards" style={{
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
          left: '-50px',
          width: '200px',
          height: '200px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
          borderRadius: '50%',
          zIndex: 0
        }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '24px' 
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
            }}>
              🎁
            </div>
            <div>
              <h2 style={{ 
                margin: 0, 
                fontSize: '1.5rem', 
                fontWeight: '700', 
                color: '#1f2937',
                letterSpacing: '-0.02em'
              }}>
                Available Rewards
              </h2>
              <p style={{ 
                margin: '4px 0 0', 
                color: '#6b7280', 
                fontSize: '0.9rem' 
              }}>
                Redeem your points for exclusive perks and benefits
              </p>
            </div>
          </div>

          {redemptionSuccess && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
            }}>
              <span style={{ fontSize: '20px' }}>✓</span>
              <span>{redemptionSuccess}</span>
            </div>
          )}

          {redemptionError && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05))',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontWeight: '500',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
            }}>
              <span style={{ fontSize: '20px' }}>⚠</span>
              <span>{redemptionError}</span>
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px',
            marginTop: '24px'
          }}>
            {AVAILABLE_REWARDS.map((reward) => {
              const canAfford = computedPoints.currentPoints >= reward.cost;
              const categoryColors = {
                promotion: { bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.3)', text: '#d97706' },
                badge: { bg: 'rgba(139, 92, 246, 0.1)', border: 'rgba(139, 92, 246, 0.3)', text: '#7c3aed' },
                discount: { bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.3)', text: '#059669' },
                support: { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)', text: '#2563eb' },
                feature: { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.3)', text: '#db2777' }
              };
              const categoryStyle = categoryColors[reward.category] || categoryColors.promotion;

              return (
                <div
                  key={reward.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    padding: '24px',
                    border: `2px solid ${canAfford ? categoryStyle.border : 'rgba(209, 213, 219, 0.5)'}`,
                    transition: 'all 0.3s ease',
                    boxShadow: canAfford ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none',
                    opacity: canAfford ? 1 : 0.7,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onMouseEnter={(e) => {
                    if (canAfford) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = canAfford ? '0 2px 8px rgba(0, 0, 0, 0.05)' : 'none';
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: categoryStyle.bg,
                    border: `1px solid ${categoryStyle.border}`,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: categoryStyle.text,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    {reward.category}
                  </div>

                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${categoryStyle.text}, ${categoryStyle.text}dd)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    marginBottom: '16px',
                    boxShadow: `0 4px 12px ${categoryStyle.text}40`
                  }}>
                    {reward.icon}
                  </div>

                  <h3 style={{
                    margin: '0 0 8px',
                    fontSize: '1.25rem',
                    fontWeight: '700',
                    color: '#1f2937'
                  }}>
                    {reward.name}
                  </h3>

                  <p style={{
                    margin: '0 0 20px',
                    color: '#6b7280',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    minHeight: '60px'
                  }}>
                    {reward.description}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    padding: '12px',
                    background: 'rgba(49, 50, 111, 0.03)',
                    borderRadius: '8px'
                  }}>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: '500' }}>
                      Cost
                    </span>
                    <span style={{ 
                      fontSize: '1.1rem', 
                      fontWeight: '700', 
                      color: '#31326f',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>⭐</span>
                      {reward.cost.toLocaleString()} pts
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleShowRewardDialog(reward)}
                    disabled={!canAfford || redeeming || loadingAccount}
                    style={{
                      width: '100%',
                      padding: '12px 20px',
                      borderRadius: '10px',
                      background: canAfford && !redeeming && !loadingAccount
                        ? `linear-gradient(135deg, ${categoryStyle.text}, ${categoryStyle.text}dd)`
                        : 'linear-gradient(135deg, #d1d5db, #e5e7eb)',
                      color: canAfford && !redeeming && !loadingAccount ? 'white' : '#9ca3af',
                      border: 'none',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: canAfford && !redeeming && !loadingAccount ? 'pointer' : 'not-allowed',
                      transition: 'all 0.3s ease',
                      boxShadow: canAfford && !redeeming && !loadingAccount
                        ? `0 4px 12px ${categoryStyle.text}40`
                        : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (canAfford && !redeeming && !loadingAccount) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = `0 6px 16px ${categoryStyle.text}60`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      if (canAfford && !redeeming && !loadingAccount) {
                        e.target.style.boxShadow = `0 4px 12px ${categoryStyle.text}40`;
                      }
                    }}
                  >
                    {!canAfford ? (
                      <>
                        <span>🔒</span>
                        Insufficient Points
                      </>
                    ) : (
                      <>
                        <span>🎁</span>
                        Redeem Now
                      </>
                    )}
                  </button>
                </div>
              );
            })}
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

      {/* Cash Redemption Confirmation Dialog */}
      {showCashRedemptionDialog && selectedCashAmount && (
        <dialog 
          ref={cashRedemptionDialogRef} 
          className="cash-redemption-confirmation-dialog" 
          style={{ 
            maxWidth: '500px', 
            width: '90%', 
            border: 'none', 
            borderRadius: '16px', 
            padding: 0, 
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' 
          }}
        >
          <style>
            {`.cash-redemption-confirmation-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>💰</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
              Confirm Cash Redemption
            </h2>
            <div style={{
              background: 'linear-gradient(135deg, rgba(49, 50, 111, 0.05), rgba(49, 50, 111, 0.02))',
              borderRadius: '12px',
              padding: '20px',
              margin: '20px 0',
              border: '2px solid rgba(49, 50, 111, 0.1)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Cash Amount
                </p>
                <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
                  ₱{selectedCashAmount.cashAmount.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(49, 50, 111, 0.2)',
                margin: '16px 0'
              }} />
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Points Required
                </p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#31326f', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>⭐</span>
                  {selectedCashAmount.pointsRequired.toLocaleString()} <span style={{ fontSize: '18px', color: '#6b7280' }}>pts</span>
                </p>
              </div>
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(49, 50, 111, 0.2)',
                margin: '16px 0'
              }} />
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Remaining Points
                </p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#31326f' }}>
                  {(computedPoints.currentPoints - selectedCashAmount.pointsRequired).toLocaleString()} <span style={{ fontSize: '16px', color: '#6b7280' }}>pts</span>
                </p>
              </div>
            </div>
            <p style={{ margin: '0 0 30px 0', fontSize: '16px', color: '#6b7280', lineHeight: '1.5' }}>
              Are you sure you want to redeem ₱{selectedCashAmount.cashAmount}? {selectedCashAmount.pointsRequired.toLocaleString()} points will be deducted from your account.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseCashRedemptionDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f9fafb';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e5e7eb';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRedeemCash}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #31326F, #637AB9)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(49, 50, 111, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #252550, #4a5a8a)';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(49, 50, 111, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #31326F, #637AB9)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.3)';
                }}
              >
                Confirm Redemption
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Reward Redemption Confirmation Dialog */}
      {showRewardDialog && selectedReward && (
        <dialog 
          ref={rewardDialogRef} 
          className="reward-confirmation-dialog" 
          style={{ 
            maxWidth: '500px', 
            width: '90%', 
            border: 'none', 
            borderRadius: '16px', 
            padding: 0, 
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)' 
          }}
        >
          <style>
            {`.reward-confirmation-dialog::backdrop {
              background: rgba(0, 0, 0, 0.5);
              backdrop-filter: blur(4px);
            }`}
          </style>
          <div style={{ padding: '30px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>{selectedReward.icon}</div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: '#1f2937' }}>
              Confirm Reward Redemption
            </h2>
            <div style={{
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(99, 102, 241, 0.02))',
              borderRadius: '12px',
              padding: '20px',
              margin: '20px 0',
              border: '2px solid rgba(99, 102, 241, 0.1)'
            }}>
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Reward
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: '#1f2937' }}>
                  {selectedReward.name}
                </p>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', lineHeight: '1.4' }}>
                  {selectedReward.description}
                </p>
              </div>
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(99, 102, 241, 0.2)',
                margin: '16px 0'
              }} />
              <div style={{ marginBottom: '16px' }}>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Points Cost
                </p>
                <p style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>⭐</span>
                  {selectedReward.cost.toLocaleString()} <span style={{ fontSize: '18px', color: '#6b7280' }}>pts</span>
                </p>
              </div>
              <div style={{
                width: '100%',
                height: '1px',
                background: 'rgba(99, 102, 241, 0.2)',
                margin: '16px 0'
              }} />
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '14px', color: '#6b7280', fontWeight: '500' }}>
                  Remaining Points
                </p>
                <p style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#31326f' }}>
                  {(computedPoints.currentPoints - selectedReward.cost).toLocaleString()} <span style={{ fontSize: '16px', color: '#6b7280' }}>pts</span>
                </p>
              </div>
            </div>
            <p style={{ margin: '0 0 30px 0', fontSize: '16px', color: '#6b7280', lineHeight: '1.5' }}>
              Are you sure you want to redeem this reward? {selectedReward.cost} points will be deducted from your account.
            </p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button
                onClick={handleCloseRewardDialog}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '2px solid #e5e7eb',
                  background: 'white',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = '#f9fafb';
                  e.target.style.borderColor = '#d1d5db';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'white';
                  e.target.style.borderColor = '#e5e7eb';
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRedeemReward}
                style={{
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                }}
                onMouseOver={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #4f46e5, #7c3aed)';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                }}
                onMouseOut={(e) => {
                  e.target.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                }}
              >
                Confirm Redemption
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};

export default Points;

