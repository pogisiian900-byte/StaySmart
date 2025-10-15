
import "../guest/guest.css"
import Logo from '/static/logo.png'
import Services from '/static/services.png'
import Home from '/static/home.png'
import Work from '/static/work.png'
import { useRef, useState } from "react"
import Guest_LoginModal from "./guest-loginModal"
import  HomePages from '../../components/Home.jsx'
import  ServicesPages from '../../components/Services.jsx'
import  ExperiencePages from '../../components/Experience.jsx'
import { useNavigate } from "react-router-dom"
function Guest_Navigation(){
    const[selectedNav, setSelectedNav] = useState("home");
    const loginModalRef = useRef(null);

    const [open,setOpen] = useState(false);
    
    const navigate = useNavigate();

    const renderPages = ()=>{

      switch (selectedNav) {
      case "home":
        return <HomePages />;
      case "service":
        return <ServicesPages />;
      case "experience":
        return <ExperiencePages />;
      default:
        return <HomePages />;
    }
  };
    return(
        <>
        <nav className="guest-nav"> 
            <div className="navLogo">
                <img src={Logo} alt=""width={"150px"} />
            </div>
            <div className="nav1">
                <div className = {selectedNav === 'home'?'navItem navActive': 'navItem' } onClick={()=> setSelectedNav("home")}>  
                    <img src={Home} alt="" width={"50px"}/>   
                    <a>Home</a>
                </div>
                    <div className={selectedNav === 'service'?'navItem navActive': 'navItem' } onClick={()=> setSelectedNav("service")}>    
                     <img src={Services} alt="" width={"50px"}/> 
                    <a>Services</a>
                </div>
                
                <div className={selectedNav === 'experience'?'navItem navActive': 'navItem' } onClick={()=> setSelectedNav("experience")}>    
                   <img src={Work} alt="" width={"50px"} /> 
                    <a>Experiences</a>
                </div>
                    
                        
                   
            </div>

            <div className="hamburgDiv">
            
                <div className="registerButton">
                    <button onClick={() => loginModalRef.current?.open()} className ='registerButtonItself'>
                        Login as Guest
                    </button>

                    <Guest_LoginModal ref={loginModalRef} />
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
            padding: "10px",
            zIndex: 999
        }}
        >
          <button title="chat with guests" onClick={()=> navigate('/host')}>Login or Signup as Host</button>
          <button title="feedback from guests">About 📖</button>
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

        <div className="guest-page">{renderPages()}</div>

        </>
    );
}

export default Guest_Navigation;