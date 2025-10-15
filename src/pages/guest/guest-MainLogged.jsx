import React, { useEffect, useState } from 'react'
import Guest_Logged_Navigation from './guest-navigation-logged'
import { Navigate, useParams } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth,db} from '../../config/firebase';

const GuestMainLogged = () => {
    const { guestId } = useParams();
    const [userData, setUserData] = useState(null);

    const [user] = useAuthState(auth);
    const[role, setRole] = useState(null);
    const [loading,setLoading] = useState(true);


    useEffect(()=>{
        
        const fetchRole = async () => {
            if(user){
                const docRef = doc(db,"Users",user.uid);
                const docSnap = await getDoc(docRef);
                if(docSnap.exists()){
                    setRole(docSnap.data().role);
                     setUserData(docSnap.data()); // ✅ save user profile info
                }
            }
            setLoading(false)
                
        
        };
        
         fetchRole();
    },[user]);
    
 
        if (loading) return <p>Loading...</p>;


      // If not a guest, block access
      if (role && role !== "guest") {
        return <p>Access denied</p>; // or redirect
      }
  return (
    <div className='guest-main-logged'>
        <Guest_Logged_Navigation userData ={userData}/>
        <h1>Welcome Logged {userData?.firstName || user?.email}</h1>
    </div>
  )
}

export default GuestMainLogged