import "../guest/guest.css"
import Guest_nav from './guest-navigation.jsx'
import Footer from "../../components/Footer.jsx";
import SearchModal from "../../components/searchModal.jsx";
import { Navigate } from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../config/firebase.js";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

function GuestMain(){
   
    return(
        <div className="guest-main">
            <Guest_nav/>
            {/* <SearchModal/> */}
            <br />
            <Footer/>
        </div>
    );
}
export default GuestMain