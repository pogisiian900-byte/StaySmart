import React, { useState } from 'react'
import '../../index.css'
import guestBack from '/static/blueBG.mp4'
import hostBack from '/static/greenhostBack.mp4'
import Part1 from './part1'
import Part2 from './part2'
import ConfirmationPart from './confirmation.jsx'
import { useParams } from 'react-router-dom'
const Registration_forAll = () => {

    const {openedAs} = useParams();
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
          uid: ""
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
           <video  autoPlay loop muted playsInline className='bg-host-video'>
                 <source src={openedAs === "guest" ? guestBack : hostBack} type="video/mp4"/>
           </video>
  
        <div className="Registration-fieldsContainer">
            {step === 1 && <Part1 formData ={registrationData} onChange ={handleChange} onNext={nextStep} openedAs ={openedAs} />}
            {step === 2 && <Part2 formData ={registrationData} onChange ={handleChange} onNext={nextStep} onPrev={prevStep} openedAs ={openedAs} />}
            {step === 3 && <ConfirmationPart formData ={registrationData} onPrev={prevStep} openedAs ={openedAs}/>}
            

        </div>
    </div>
  )
}

export default Registration_forAll;