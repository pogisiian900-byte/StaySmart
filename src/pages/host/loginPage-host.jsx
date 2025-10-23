import React, { useState, useEffect } from 'react';
import '../../index.css';
import User from '/static/user.png';
import Lock from '/static/lock.png';
import Unlock from '/static/unlock.png';
import Google from '/static/google.png';
import Facebook from '/static/facebook.png';
import Email from '/static/email.png';
import { Navigate, useNavigate } from 'react-router-dom';
import { auth, db } from '../../config/firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signOut,
} from 'firebase/auth';
import background from '/static/blueBG.mp4'
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

  // ✅ If already logged in as host, redirect
  if (user && role === 'host') {
    return <Navigate to={`/host/${user.uid}`} replace />;
  }


  // 🔑 Email login function
  const loginHost = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const docRef = doc(db, 'Users', user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('No profile data found in Firestore');
    const data = docSnap.data();
    if (data.role !== 'host') throw new Error('Access denied: Not a host user');

    return { uid: user.uid, email: user.email, ...data };
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userData = await loginHost(email, password);
      alert('✅ Successfully logged in as Host');
      navigate(`/host/${userData.uid}`, { replace: true });
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  // 🟢 Google Login
  
const handleGoogleLogin = async () => {
  const navigate = useNavigate();
  const provider = new GoogleAuthProvider();

  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userRef = doc(db, "Users", user.uid);
    const docSnap = await getDoc(userRef);

    // ✅ Create full user document if it doesn't exist
    if (!docSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        firstName: user.displayName?.split(" ")[0] || "",
        middleName: "",
        lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
        phoneNumber: user.phoneNumber || "",
        emailAddress: user.email || "",
        birthday: "",
        password: "",
        province: "",
        city: "",
        barangay: "",
        street: "",
        zipCode: 0,
        role: "host", // since this is Host login
        createdAt: new Date(),
      });
    } else if (docSnap.data().role !== "host") {
      // ❌ Block non-hosts
      throw new Error("Access denied: Not a Host account");
    }

    alert("✅ Logged in with Google as Host");
    navigate(`/host/${user.uid}`, { replace: true });

  } catch (error) {
    console.error(error);
    alert(`❌ Google login failed: ${error.message}`);
    await signOut(auth);
  }
};

  // 🔵 Facebook Login
  const handleFacebookLogin = async () => {
    const provider = new FacebookAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userRef = doc(db, 'Users', user.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        firstName: user.displayName?.split(" ")[0] || "",
        middleName: "",
        lastName: user.displayName?.split(" ").slice(1).join(" ") || "",
        phoneNumber: user.phoneNumber || "",
        emailAddress: user.email || "",
        birthday: "",
        password: "",
        province: "",
        city: "",
        barangay: "",
        street: "",
        zipCode: 0,
        role: "host", // since this is Host login
        createdAt: new Date(),
      });
    } else if (docSnap.data().role !== "host") {
      // ❌ Block non-hosts
      throw new Error("Access denied: Not a Host account");
    }

      alert('✅ Logged in with Facebook as Host');
      navigate(`/host/${user.uid}`, { replace: true });
    } catch (error) {
      console.error(error);
      alert(`❌ Facebook login failed: ${error.message}`);
      await signOut(auth);
    }
  };

  return (
    <div className="LoginPage_Host">
      <video autoPlay loop muted playsInline className="bg-host-video">
        <source src={background} type="video/mp4" />
      </video>

      <div className="login-host-card">
        <h1>Host | Log in</h1>
        <form onSubmit={handleEmailLogin}>
          <div className="host-login-field-group">
            <div className="host-login-field">
              <img src={User} alt="" width="50px" />
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
                alt=""
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
          <br />
          <p className="forgotPass-host">Forgot Password?</p>
          <button type="submit" className="login-host-submit">
            Login
          </button>
        </form>

        <hr />
        <div className="login-other-host">
          <button onClick={handleGoogleLogin}>
            <img src={Google} alt="" width="30px" /> Continue with Google
          </button>
          <button onClick={handleFacebookLogin}>
            <img src={Facebook} alt="" width="30px" /> Continue with Facebook
          </button>
          <button onClick={() => navigate('/register/host')}>
            <img src={Email} alt="" width="30px" style={{ marginRight: '20px' }} />
            Continue with Email
          </button>

          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              gap: '10px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="30px"
              viewBox="0 -960 960 960"
              width="30px"
              fill="#e3e3e3"
            >
              <path d="M680-160v-400H313l144 144-56 57-241-241 240-240 57 57-144 143h447v480h-80Z" />
            </svg>
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage_Host;
