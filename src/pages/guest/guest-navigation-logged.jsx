
import "../host/host.css"
import Logo from '/static/logo.png'
import Services from '/static/services.png'
import Home from '/static/home.png'
import Work from '/static/work.png'
import profile from '/static/me.png'
import { useState } from "react"
import { signOut } from "firebase/auth";
import { useNavigate  } from "react-router-dom";
import { auth } from "../../config/firebase"

function Guest_Logged_Navigation({userData}){

    const [open,setOpen] = useState(false);
    const navigate = useNavigate ();

    const handleLogout = async () =>{
        try {
            await signOut(auth);
            console.log("Guest logged out");
            navigate("/");
        }catch(err){
            console.error("Logout failed:", err.message);
        }
    }
    return(
        <>
        <nav className="guest-nav"> 
            <div className="navLogo">
                <img src={Logo} alt=""width={"150px"} />
            </div>
            <div className="nav1">
                <div className="navItem navActive">  
                    <img src={Home} alt="" width={"50px"}/>   
                    <a href="#">Home</a>
                </div>
                    <div className="navItem">    
                     <img src={Services} alt="" width={"50px"}/> 
                    <a href="#">Services</a>
                </div>
                
                <div className="navItem">    
                   <img src={Work} alt="" width={"50px"} /> 
                    <a href="#">Experiences</a>
                </div>
                    
                        
                   
            </div>

            <div className="host-hamburgDiv">
                <p>Guest: </p>
               <div className="profileDiv">
              <p>{userData?.firstName|| "Guest"}</p>

                <img src={profile} alt="" width={"50px"} />
               </div>
               
                <button 
                className ='hamburgButton-guest'
              onClick={() => setOpen(!open)}
                    style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                    }}>
                    <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#000000ff"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>
                </button>
                
            {open && (

                <div className="hamburgSelection"
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
                    zIndex: 999
        }}
        >
      
            <button title="chat with guests">Bookings 📅</button>
            <button title="feedback from guests">Wishlist / Favorites ❤️</button>
            <button title="Profile">Messages 💬</button>
            <button title="booking updates| payout reminders">Account Settings ⚙️</button>
            <button>Notifications 🔔</button>
            <button title="Contact admin">Help 📞</button>
            <button title="Log out as Guest" onClick={handleLogout}>Logout 🚪</button>
        
        </div>
    )}  

            
            </div>

            
        </nav>
        <div className="searchBar">
            <button> 
                <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="aliceblue"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg> 
                 Search
                </button>
        </div>
        </>
    );
}

export default Guest_Logged_Navigation;