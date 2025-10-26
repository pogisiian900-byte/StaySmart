import React, { useState, useEffect } from 'react';
import '../../index.css';
import User from '/static/user.png';
import Lock from '/static/lock.png';
import Unlock from '/static/unlock.png';
import background from '/static/blueBG.mp4';
import { Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from '../../config/firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../layout/AuthContext';

const LoginPage_Host = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // 🔍 Check logged-in user's role
  useEffect(() => {
    const fetchRole = async () => {
      if (user) {
        const docRef = doc(db, 'Users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setRole(docSnap.data().role);
      }
      setCheckingRole(false);
    };
    fetchRole();
  }, [user]);

  if (loading || checkingRole) return <p>Loading...</p>;

  // ✅ If already logged in, redirect by role
  if (user && role) {
    if (role === 'host') return <Navigate to={`/host/${user.uid}`} replace />;
    if (role === 'guest') return <Navigate to={`/guest/${user.uid}`} replace />;
    if (role === 'admin') return <Navigate to={`/admin/${user.uid}`} replace />;
  }

  // 🔑 Email login function (allows any role)
  const loginUser = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const docRef = doc(db, 'Users', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('No profile data found in Firestore');

    const data = docSnap.data();
    return { uid: user.uid, email: user.email, ...data };
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userData = await loginUser(email, password);
      alert(`✅ Logged in as ${userData.role || 'User'}`);

      if (userData.role === 'host') {
        navigate(`/host/${userData.uid}`, { replace: true });
      } else if (userData.role === 'guest') {
        navigate(`/guest/${userData.uid}`, { replace: true });
      } else if (userData.role === 'admin') {
        navigate(`/admin/${userData.uid}`, { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  // 🟢 Google login (for any role)
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'Users', user.uid);
      const docSnap = await getDoc(userRef);

      // ✅ Create user doc if missing
      if (!docSnap.exists()) {
        const newUser = {
          uid: user.uid,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          phoneNumber: user.phoneNumber || '',
          emailAddress: user.email || '',
          role: 'guest', // default role if none
          createdAt: new Date(),
        };
        await setDoc(userRef, newUser);
        alert('✅ Account created successfully using Google');
        navigate(`/guest/${user.uid}`, { replace: true });
      } else {
        const userData = docSnap.data();
        alert(`✅ Logged in as ${userData.role}`);

        if (userData.role === 'host') {
          navigate(`/host/${user.uid}`, { replace: true });
        } else if (userData.role === 'guest') {
          navigate(`/guest/${user.uid}`, { replace: true });
        } else if (userData.role === 'admin') {
          navigate(`/admin/${user.uid}`, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      }
    } catch (error) {
      console.error(error);
      await signOut(auth);
    }
  };

  return (
    <div className="LoginPage_Host">
      <video autoPlay loop muted playsInline className="bg-host-video">
        <source src={background} type="video/mp4" />
      </video>

      <div className="login-host-card">
        <h1>Stay Smart</h1>
        <form onSubmit={handleEmailLogin}>
          <div className="host-login-field-group">
            <div className="host-login-field">
              <img src={User} alt="user icon" width="50px" />
              <input
                type="text"
                placeholder="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="host-login-field">
              <img
                onClick={() => setShowPassword((prev) => !prev)}
                alt="lock icon"
                width="50px"
                src={showPassword ? Unlock : Lock}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="forgotPass-host">Forgot Password?</p>
          <button type="submit" className="login-host-submit">
            Login
          </button>
        </form>

        <hr />
        <div className="login-other-host">
          <button onClick={handleGoogleLogin}>
            <svg
              style={{ marginRight: '20px' }}
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.88 21.94 15.46 14" />
              <path d="M21.17 8H12" />
              <path d="M3.95 6.06 8.54 14" />
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
            </svg>
            Continue with Google
          </button>

          <button onClick={() => navigate('/register')}>
            <svg
              style={{ marginRight: '20px' }}
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
              <rect x="2" y="4" width="20" height="16" rx="2" />
            </svg>
            Continue with Email
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage_Host;
