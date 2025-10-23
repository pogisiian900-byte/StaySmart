import React, { useEffect, useState } from 'react'
import { db } from '../../config/firebase.js'
import { collection , addDoc, setDoc,doc } from 'firebase/firestore'
import { auth } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import secureMail from '/static/secureMail.webp'
const confirmationModal = ({openedAs,formData,onPrev}) => {

  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const[ userUID, setUserUID] = useState(null);

  const HandleSubmit = async () => {
  try {
    setIsSubmitting(true);
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      formData.emailAddress,
      formData.password
    );

    const user = userCredential.user;

    await setDoc(doc(db, "Users", user.uid), {
      uid: user.uid,
      firstName: formData.firstName,
      lastName: formData.lastName,
      middleName: formData.middleName,
      phoneNumber: formData.phoneNumber,
      emailAddress: formData.emailAddress,
      role: formData.role,
      barangay: formData.barangay,
      birthday: formData.birthday,
      city: formData.city,
      province: formData.province,
      street: formData.street,
      zipCode: formData.zipCode,
    });

    if (openedAs === "host") {
      await setDoc(doc(db, "Host", user.uid), {
        userId: user.uid,
      });
    }

    alert("Account Created!");
    handleReturntoLogin(user.uid); // ✅ pass uid directly here
  } catch (error) {
    console.error(error);
    alert("Something went wrong, try again!");
  } finally {
    setIsSubmitting(false);
  }
};

// ✅ Modify handleReturntoLogin to accept a uid argument
const handleReturntoLogin = (uid) => {
  if (openedAs === "host") {
    navigate(`/getStarted/host/${uid}`);
  } else if (openedAs === "guest") {
    navigate('/');
  } else {
    alert("ACCOUNT NOT FOUND | OR ERROR");
  }
};

  return (
    <div className='confrimation-registration'>
      <div className="back-group-verify">

        <button onClick={onPrev} className={`confrimation-registration-Goback`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-left-icon lucide-arrow-left"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
        </button>
        <p>Go Back</p>
      </div>

      <div className="confrimation-registration-content">
        <h1>Please verify {formData.emailAddress|| "No Email"}</h1>
        <img className='verifyIcon' src={secureMail} alt="" />
        <p>We just sent a verification code in your Email:</p>

        <input type="number" className='verfication-code-field' placeholder='Enter sent 6 pin code '/>
        <button className='resendButton-verify'>Resend Code</button>
  
      </div>
      
        <button onClick={HandleSubmit} disabled ={isSubmitting} className={`confrimation-registration-createButton ${openedAs}`}> Verify Code</button>
    </div>
  )
}

export default confirmationModal