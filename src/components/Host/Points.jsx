import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const TIER_LEVELS = [
  { id: "member", label: "Member", minPoints: 0, multiplier: 1 },
  { id: "silver", label: "Silver Host", minPoints: 1000, multiplier: 1.1 },
  { id: "gold", label: "Gold Host", minPoints: 5000, multiplier: 1.25 },
  { id: "platinum", label: "Platinum Host", minPoints: 15000, multiplier: 1.5 },
];

const ACHIEVEMENTS = [
  {
    id: "first-booking",
    title: "First Booking",
    description: "Completed your first confirmed stay.",
    pointsRequired: 250,
    badge: "🥇",
  },
  {
    id: "five-star-host",
    title: "Five-Star Host",
    description: "Maintain a 4.8+ review score for 30 days.",
    pointsRequired: 1200,
    badge: "⭐",
  },
  {
    id: "frequent-host",
    title: "Frequent Host",
    description: "Reach 25 confirmed reservations in a year.",
    pointsRequired: 4500,
    badge: "🚀",
  },
  {
    id: "superstay",
    title: "Super Stay",
    description: "Host a guest for 14+ consecutive nights.",
    pointsRequired: 8000,
    badge: "🏆",
  },
];

const EARNING_OPPORTUNITIES = [
  {
    title: "Accept requests quickly",
    detail: "Earn bonus points by responding to new requests within 1 hour.",
    points: "+80 pts per response",
  },
  {
    title: "Maintain five-star reviews",
    detail: "Each 5★ review adds a loyalty boost to your monthly total.",
    points: "+150 pts per review",
  },
  {
    title: "Fill calendar gaps",
    detail: "Use Instant Book to earn additional points on short-notice stays.",
    points: "+200 pts per booking",
  },
  {
    title: "Promote returning guests",
    detail: "Offer repeat guests a discount and collect double points.",
    points: "2× multiplier",
  },
];

const REWARD_OPTIONS = [
  {
    id: "boosted-placement",
    title: "Boosted Placement",
    description: "Feature one listing in local search results for 7 days.",
    cost: 5000,
    status: "Available soon",
  },
  {
    id: "service-fee-discount",
    title: "Service Fee Discount",
    description: "Apply a 20% discount to host service fees next month.",
    cost: 8000,
    status: "Unlock at Gold tier",
  },
  {
    id: "pro-photos",
    title: "Professional Photography",
    description: "Redeem a voucher for a professional photo shoot.",
    cost: 15000,
    status: "Coming soon",
  },
];

const Points = ({ hostId }) => {
  const [pointsData, setPointsData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState(null);

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
        },
        (err) => {
          console.error("Failed to load points history:", err);
          setError("We couldn't load your earning history right now. Please try again later.");
          setLoadingHistory(false);
        }
      );

      return () => unsub();
    } catch (err) {
      // Covers cases where the collection/index might not exist yet
      console.warn("Points history unavailable:", err);
      setHistory([]);
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

  const achievements = useMemo(() => {
    return ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      achieved: computedPoints.currentPoints >= achievement.pointsRequired,
      progress: Math.min(
        100,
        (computedPoints.currentPoints / achievement.pointsRequired) * 100
      ),
    }));
  }, [computedPoints.currentPoints]);

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

      <section className="host-points-achievements">
        <div className="section-header">
          <h2>Achievements</h2>
          <p>Hit new milestones to unlock exclusive badges and bonus rewards.</p>
        </div>
        <div className="achievement-grid">
          {achievements.map((achievement) => (
            <article
              key={achievement.id}
              className={`achievement-card ${achievement.achieved ? "achieved" : ""}`}
            >
              <div className="achievement-icon">{achievement.badge}</div>
              <div className="achievement-content">
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <span className="achievement-target">
                  {achievement.achieved
                    ? "Completed"
                    : `${achievement.pointsRequired.toLocaleString()} pts needed`}
                </span>
                <div className="achievement-progress">
                  <div
                    className="achievement-progress-fill"
                    style={{ width: `${achievement.progress}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="host-points-actions">
        <div className="action-card">
          <h3>Earn more points</h3>
          <p>Confirm stays promptly and keep your acceptance rate high to maximise rewards.</p>
          <button
            type="button"
            onClick={() => window?.scrollTo?.({ top: 0, behavior: "smooth" })}
          >
            View tips
          </button>
        </div>
        <div className="action-card">
          <h3>Redeem perks</h3>
          <p>Use your balance for promotional boosts, featured listings, or partner perks.</p>
          <button type="button" disabled>
            Coming soon
          </button>
        </div>
      </section>

      <section className="host-points-earnings">
        <div className="section-header">
          <h2>How to earn points</h2>
          <p>Build consistent hosting habits to stack loyalty bonuses quickly.</p>
        </div>
        <div className="earning-list">
          {EARNING_OPPORTUNITIES.map((item) => (
            <div key={item.title} className="earning-item">
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
              <span className="earning-points">{item.points}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="host-points-rewards">
        <div className="section-header">
          <h2>Redeem rewards</h2>
          <p>Trade loyalty points for tools that grow bookings and improve guest experience.</p>
        </div>
        <div className="reward-grid">
          {REWARD_OPTIONS.map((reward) => (
            <div key={reward.id} className="reward-card">
              <div className="reward-header">
                <h3>{reward.title}</h3>
                <span className="reward-cost">{reward.cost.toLocaleString()} pts</span>
              </div>
              <p>{reward.description}</p>
              <button type="button" disabled>
                {reward.status}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="host-points-history">
        <div className="history-header">
          <h2>Recent activity</h2>
          {!loadingHistory && history.length > 0 && (
            <span>{history.length} most recent transactions</span>
          )}
        </div>

        {loadingHistory ? (
          <div className="history-empty">
            <p>Loading your latest rewards…</p>
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <p>No activity yet. Complete bookings to earn your first points.</p>
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
};

export default Points;

