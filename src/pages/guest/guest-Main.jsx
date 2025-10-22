import React, { useRef } from "react";
import Guest_LoginModal from "../guest/guest-loginModal";
import { useNavigate } from "react-router-dom";

const GuestMain = () => {
  const navigate = useNavigate();
  const loginModalRef = useRef(null);

  const openLogin = () => {
    loginModalRef.current?.open(); // calls open() defined inside Guest_LoginModal
  };

  const closeLogin = () => {
    loginModalRef.current?.close(); // optional if you want to close manually
  };

  return (
    <div className="guest-main">
      <h1>Hero Page na eto</h1>

      {/* Button that triggers modal */}
      <button onClick={openLogin}>Login as Guest</button>
<button onClick={()=> navigate('/host')}>Become as Host</button>
      {/* The modal itself */}
      <Guest_LoginModal ref={loginModalRef} />
    </div>
  );
};

export default GuestMain;
