import React, { useEffect } from 'react'
import work from '/static/work.mp4'
import { useNavigate } from 'react-router-dom'
const Part1 = ({openedAs,formData,onChange,onNext}) => {

  const navigate = useNavigate();

  useEffect(() =>{
    if (openedAs) {
      onChange("role", openedAs);
    }
  },[openedAs])
  const handleSubmit = (e) => {
      e.preventDefault();

      if(e.target.checkValidity()){
        onNext();
      }else{
        e.target.reportValidity();
      }
  }
  const handleReturn = () =>{
    if(openedAs === "host"){
      navigate('/host');
    }else if(openedAs === "guest"){
         navigate('/');
    }else{
      alert("ACCOUNT NOT FOUND | OR ERROR")
    }
  }
  return (
    
    <div className='part1'> 
        <h1>User Credentials (Part: 1 of 3)</h1>
            <form onSubmit={handleSubmit}>
              
              <div className={`regis-field-div ${openedAs}`}>
                <label htmlFor="">First Name:</label>
                <input type="text" 
                placeholder=' ' 
                value={formData.firstName}
                onChange={(e) => onChange("firstName",e.target.value)}
                required/>
                
              </div>
              
              <div className={`regis-field-div ${openedAs}`}>
                <label htmlFor="">Last Name:</label>
                <input type="text" 
                placeholder=' ' 
                value={formData.lastName}
                onChange={(e) => onChange("lastName",e.target.value)}
                required/>
              </div>

              <div className={`regis-field-div ${openedAs}`}>
                <label htmlFor="">Middle Name:</label>
                <input type="text" 
                placeholder=' ' 
                 value={formData.middleName}
                onChange={(e) => onChange("middleName",e.target.value)}
                required/>
              </div>
               <div className={`regis-field-div ${openedAs}`}>
                  <label htmlFor="phone">Phone Number:</label>
                <input id="phone"
                      type="tel"
                      placeholder="ex. 09053250455"
                      pattern="[0-9]{4}[0-9]{3}[0-9]{4}"
                      value={formData.phoneNumber}
                      onChange={(e) => onChange("phoneNumber",e.target.value)}
                      required
                  />
                  </div>
                     
                  <div className={`regis-field-div ${openedAs}`}>
                    <label htmlFor="birthday">Birthday:</label>
                    <input
                      id="birthday"
                      type="date"
                      name="birthday"
                      value={formData.birthday}
                      onChange={(e) => onChange("birthday", e.target.value)}
                      min="1900-01-01"
                      max="2100-12-31"
                      required
                    />
                  </div>
               <br />
               <hr />
               <br />
                <div className={`regis-field-div ${openedAs}`}>
                <label htmlFor="">Email Address:</label>
                <input type="text" 
                placeholder='ex. example@gmail.com' 
                value={formData.emailAddress}
                onChange={(e) => onChange("emailAddress",e.target.value)}
                required/>
                </div>
                 <div className={`regis-field-div ${openedAs}`}>
                <label htmlFor="">Password:</label>
                <input type="password" 
                placeholder='' 
                value={formData.password}
                onChange={(e) => onChange("password",e.target.value)}
                minLength={6}
                required/>
                {formData.password.length > 0 && formData.password.length < 6 && (
                  <p style={{ color: "red", fontSize: "0.9em" }}>
                    Password must be at least 6 characters
                  </p>
                )}
                </div>
                <div className={`regis-button-next ${openedAs}`}>
                  <button type='button' onClick={handleReturn}>Back to Home</button>
                  <button type='sumbit'>Next</button>
                </div>
            </form>
    </div>
  )
}

export default Part1;
