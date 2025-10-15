import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState, use } from "react";
import Google from '/static/google.png'
import Facebook from '/static/facebook.png'
import Email from '/static/email.png'
import { useNavigate } from "react-router-dom";
import {auth, db} from '../../config/firebase'
import {signInWithEmailAndPassword} from 'firebase/auth'
import { collection, doc, getDoc,getDocs } from "firebase/firestore";



const Guest_LoginModal = forwardRef((props, ref) => {
  const modalRef = useRef(null);
  const [showPassword,setShowPassword] = useState(false);

  const[email,setEmail] = useState("");
  const[password,setPassword] = useState("");

  const navigate = useNavigate();
  useImperativeHandle(ref, () => ({
    open: () => modalRef.current?.showModal(),
    close: () => modalRef.current?.close(),
  }));

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;

    const handleClickOutside = (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog =
        rect.top <= e.clientY &&
        e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX &&
        e.clientX <= rect.left + rect.width;

      if (!isInDialog) {
        modal.close();
      }
    };

    modal.addEventListener("click", handleClickOutside);

    return () => {
      modal.removeEventListener("click", handleClickOutside);
    };

    
  }, []);


  const loginGuest= async (email, password) => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;

  const docRef = doc(db, "Users", user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const userData = { ...user, ...docSnap.data() };

    if (userData.role === "guest") {
      return userData; // ✅ Only return if host
    } else {
      throw new Error("Access denied: Not a Guest user");
    }
  } else {
    throw new Error("No profile data found in Firestore");
  }
};

const handleEmailLogin = async (e) => {
  e.preventDefault();
  try { 
    const userData = await loginGuest(email, password);
    if(userData.role === "guest"){
      alert("✅ Successfully logged in as Guest");
      navigate(`/guest/${userData.uid}`,{replace: true});
    }else{
      alert("❌Unsuccessfully logged in as Guest");

    }
  } catch (err) {
    alert(`❌ ${err.message}`);
    // Do NOT navigate
  }
};

  const getAllUsers = async () => {
  try {
    const querySnapshot = await getDocs(collection(db, "Users"));
    const users = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log("All users:", users);
    return users;
  } catch (error) {
    console.error("Error fetching users:", error);
  }
};
getAllUsers();



  return (
    <dialog ref={modalRef} className="guest-loginModal">
      <div className="login-topbar">
        <p> Guest | Login or Signup</p>
        <span onClick={() => modalRef.current?.close()}>
          X
        </span>
      </div>

      <div className="login-fields">
        <form onSubmit={handleEmailLogin} >
          <input type="email" placeholder="Email" value={email} onChange={(e)=> setEmail(e.target.value)}  required />
              <input type={showPassword ? "text": "password" } placeholder="Password" value={password} onChange={(e)=> setPassword(e.target.value)} required />
             <p className="showPassword-loginModal" onClick={()=> setShowPassword((prev) => !prev)}>{showPassword ? "🙈 Hide password": "👁️ Show password"}</p>
                <p className="forgotPass">Forgot Password?</p>
              <br />
          <button type="submit" className="loginButton-loginModal">Login</button>
          <hr />
        </form>
      </div>
          <div className="login-other">
            <br />
            <button><img src={Google} alt="" width={"30px"}/> Continue with Google</button>
            <button><img src={Facebook} alt="" width={"30px"}/> Continue with Facebook</button>
            <button onClick={()=> navigate('/register/guest')}
              ><img src={Email} alt="" width={"30px"} style={{marginRight: "20px"}} />
             Continue with Email
             </button>
          </div>
      
    </dialog>
  );
});

export default Guest_LoginModal;
