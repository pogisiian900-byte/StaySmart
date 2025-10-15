
import { useState } from "react";
import "../host/host.css"
import Logo from '/static/logo.png'
import { useNavigate, useParams } from "react-router-dom";
import { auth } from "../../config/firebase";
import { signOut } from "firebase/auth";
import HostDashboard from "../../components/Host/Dashboard";
import Listings from "../../components/Host/Listings";
import Bookings from "../../components/Host/Bookings";
import Earnings from "../../components/Host/Earnings";
import profile from '/static/me.png'
function Host_Navigation({userData}){
    const [open,setOpen] = useState(false);
    const [renderedPage, setRenderedPage] = useState("dashboard");
    const [selectedNav, setSelectedNav] = useState("dashboard")
    const navigate = useNavigate();

    const handleLogout = async () =>{
            try {
                await signOut(auth);
                console.log("Host logged out");
                navigate("/host",{replace: true});
            }catch(err){
                console.error("Logout failed:", err.message);
            }
        }

        const renderingPages = () =>{


            switch(renderedPage){
            case "dashboard": 
              return <HostDashboard/>

            case "listings":
                return <Listings/>
                
            case "reservations":
                return <Bookings/>
                
            case "earnings": 
                return <Earnings/>
            
            default:
            
            return <p>Page not Found</p>
               
            }
            
        }
    return(
        <>
        <nav className="guest-nav"> 
            <div className="navLogo">
                <img src={Logo} alt=""width={"150px"} />
            </div>
            <div className="nav1">
                <div className={selectedNav ==="dashboard"? "navItem navActive": "navItem"} 
                onClick={()=> {
                    setRenderedPage("dashboard")
                    setSelectedNav("dashboard")
                    }}>  
                    <a href="#">Dashboard 🏠</a>
                </div>
                    <div className={selectedNav ==="listings"? "navItem navActive": "navItem"}  
                    onClick={()=> {
                        setRenderedPage("listings")
                        setSelectedNav("listings")
                        }}>    
                    <a href="#">Listings 📦</a>
                </div>
                
                <div className={selectedNav ==="reservations"? "navItem navActive": "navItem"}  
                onClick={()=> {
                    setRenderedPage("reservations")
                    setSelectedNav("reservations");

                }}>    
                    <a href="#">Reservations 📅</a>
                </div>
                     <div className={selectedNav ==="earnings"? "navItem navActive": "navItem"}  
                     onClick={()=> {
                        setRenderedPage("earnings");
                        setSelectedNav("earnings");
                        }}>    
                    <a href="#">Earnings 💵</a>
                </div>
                        
                   
            </div>

            <div className="searchBar">
            <button> 
                <svg xmlns="http://www.w3.org/2000/svg" height="100px" viewBox="0 -960 960 960" width="100px" fill="aliceblue"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg> 
                </button>
             </div>
            <div className="host-hamburgDiv">
               <button className="notification-host-Button">
                <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#f2ff00ff"><path d="M160-200v-80h80v-280q0-83 50-147.5T420-792v-28q0-25 17.5-42.5T480-880q25 0 42.5 17.5T540-820v28q80 20 130 84.5T720-560v280h80v80H160Zm320-300Zm0 420q-33 0-56.5-23.5T400-160h160q0 33-23.5 56.5T480-80ZM320-280h320v-280q0-66-47-113t-113-47q-66 0-113 47t-47 113v280Z"/></svg>
               </button>
                
               <div className="profileDiv" onClick={() =>navigate('profile')} >
                <button
                >
                    Profile:  {userData.firstName||"None"}
                    
                </button>
                <img src={profile} alt="" width={"50px"} />
               </div>
                <button  onClick={() => setOpen(!open)}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                    }}
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#000000ff"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>
                </button>
            </div>
                  {open && (
        <div
          className="hamburgSelection"
          style={{
            position: "absolute",
            top: "60px",
            right: 0,
            background: "#fff",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            minWidth: "200px",
            padding: "10px",
            zIndex: 999,
          }}
        >
          <button title="chat with guests">Messages 💬</button>
          <button title="Profile">Account Settings ⚙️</button>
          <button title="booking updates| payout reminders">Notifications 🔔</button>
          <button title="Contact admin">Help 📞</button>
          <button title="Logging out as Host" onClick={handleLogout}>Logout 🚪</button>
        </div>
      )}


            
        </nav>

    
        <div className="host-main-page">{renderingPages()}</div>
        </>
    );
}

export default Host_Navigation;