import React, { useState } from 'react'
import '../../index.css'
import User from '/static/user.png'
import Lock from '/static/lock.png'
import Unlock from '/static/unlock.png'
import Google from '/static/google.png'
import Facebook from '/static/facebook.png'
import Email from '/static/email.png'
import background from '/static/greenhostBack.mp4'
import { Navigate, useNavigate } from 'react-router-dom'
import {auth, db} from '../../config/firebase'
import {signInWithEmailAndPassword} from 'firebase/auth'
import { collection, doc, getDoc,getDocs } from "firebase/firestore";
import { useAuth } from '../../layout/AuthContext'

const LoginPage_Host = () => {
    const [showPassword,setShowPassword] = useState(false);
    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
     const navigate = useNavigate();

    const { user, loading } = useAuth();

     if (loading) return <p>Loading...</p>;


      if (user) {
    // user is already logged in, skip login page
    return <Navigate to={`/host/${user.uid}`} replace />;
  }

     const loginHost = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const docRef = doc(db, "Users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error("No profile data found in Firestore");

    const data = docSnap.data();
    if (data.role !== "host") throw new Error("Access denied: Not a host user");

    return { uid: user.uid, email: user.email, ...data };
  } catch (err) {
    throw err;
  }
};


const handleEmailLogin = async (e) => {
  e.preventDefault();
  try {
    const userData = await loginHost(email, password);
    
    if(userData.role === "host"){
      alert("✅ Successfully logged in as Host");
      navigate(`/host/${userData.uid}`,{replace: true});

    
    }
  } catch (err) {
    alert(`❌ ${err.message}`);
    // Do NOT navigate
  }
};


  return (
    <>
    <div className='LoginPage_Host'>
       <video  autoPlay loop muted playsInline className='bg-host-video'>
          <source src={background} type="video/mp4"/>
       </video>

      <div className="login-host-card">
          <h1>Host | Log in</h1>
          <form onSubmit={handleEmailLogin}>
          <div className="host-login-field-group">
                  <div className="host-login-field">
                    <img src={User} alt="" width={"50px"}/>
                    <input type="text"  placeholder='Email Address' value={email} onChange={(e)=> setEmail(e.target.value)} required/>
                  </div>

                  <div className="host-login-field">
                    <img onClick={() => setShowPassword((prev) => !prev)} alt="" width={"50px"}  src={showPassword ? Unlock : Lock}/>
                    <input type={showPassword  ? "text": 'password'} placeholder='Password' value={password} onChange={(e)=> setPassword(e.target.value)} required/>
                  </div>
              </div>
              <br />  
              <p className="forgotPass-host">Forgot Password?</p>
              <button type='submit' className='login-host-submit'>Login</button>
            </form>
          <hr />
          <div className="login-other-host">
            <button><img src={Google} alt="" width={"30px"}/> Continue with Google</button>
            <button><img src={Facebook} alt="" width={"30px"}/> Continue with Facebook</button>
            <button 
            onClick={()=> navigate('/register/host')}
            >
              <img src={Email} alt="" width={"30px"} style={{marginRight: "20px"}}/>
               Continue with Email
               </button>
            <button onClick={()=> navigate('/')} style={{
              display:"flex",
              gap:"10px"
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#e3e3e3"><path d="M680-160v-400H313l144 144-56 57-241-241 240-240 57 57-144 143h447v480h-80Z"/></svg>
              Return to Home
              </button>
          </div>
      </div>
    </div>
    </>
  )
}

export default LoginPage_Host