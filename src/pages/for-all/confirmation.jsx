import React, { useEffect, useState } from 'react'
import { db } from '../../config/firebase.js'
import { collection , addDoc, setDoc,doc } from 'firebase/firestore'
import { auth } from '../../config/firebase'
import { useNavigate } from 'react-router-dom'
import { createUserWithEmailAndPassword } from 'firebase/auth'
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
        <h1>Account Confirmation:</h1>
        <p><b>Full Name:</b> {formData.firstName} {formData.lastName} {formData.middleName}</p>
        <p><b>Birthday: </b>{formData.birthday}</p>
        <p><b>Email Address:</b> {formData.emailAddress}</p>
        <p><b>Phone Number:</b> {formData.phoneNumber}</p>
        <p><b>Role:</b> {formData.role}</p>
        <p><b>Address:</b> Street of  {formData.street} | {formData.barangay}, {formData.city}, {formData.province} </p>
        <p><b>Zip Code:</b> {formData.zipCode}</p>

        <button onClick={HandleSubmit} disabled ={isSubmitting} className={`confrimation-registration-createButton ${openedAs}`}>Confirm & Create Account</button>
        <button onClick={onPrev} className={`confrimation-registration-Goback`}>Go Back</button>
    </div>
  )
}

export default confirmationModal