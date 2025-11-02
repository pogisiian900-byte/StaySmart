import React, { useState } from 'react'
import '../../index.css'
import bgVideo from '/static/blueBG.mp4'
import Part1 from './part1'
import Part2 from './part2'
import ConfirmationPart from './confirmation.jsx'
import { useParams } from 'react-router-dom'
const Registration_forAll = () => {

      const[step,setStep]= useState(1);
  
      const[registrationData,setRegistrationData] = useState({
          firstName: "",
          lastName: "",
          middleName: "",
          phoneNumber: "",
          emailAddress: "",
          birthday:"",
          password:"",
          province: "",
          city: "",
          barangay: "",
          street: "",
          zipCode: 0,
          role: "",
          uid: "",
          favourites: [],
          profilePicture: ""
      });
      const nextStep = () =>{ 
        setStep((prev) => prev + 1);
        console.log(registrationData)
        console.log(step)
    };
      const prevStep = () => setStep(( prev) => prev - 1);

      const handleChange =(field, value) =>{
          setRegistrationData((prev)=>({...prev, [field]: value}));
      };
  return (
    <div className='registration-all-parent'>
           <video autoPlay loop muted playsInline className="registration-video-bg">
        <source src={bgVideo} type="video/mp4" />
      </video>
  
        <div className="Registration-fieldsContainer"> {/* CARD*/}
            {step === 1 && <Part1 formData ={registrationData} onChange ={handleChange} onNext={nextStep}  />}
            {step === 2 && <Part2 formData ={registrationData} onChange ={handleChange} onNext={nextStep} onPrev={prevStep}/>}
            {step === 3 && <ConfirmationPart formData ={registrationData} onPrev={prevStep} />}
            

        </div>
    </div>
  )
}

export default Registration_forAll;