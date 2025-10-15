import React from 'react'
import photography from '/static/services Photos/photography.png'
import servicesData from '../data.json'
import '../pages/guest/guest.css'
const Experience = () => {
  const yourLocation = "Manila"; // is important for the number of available services their.
 

  function getNumberAvailable(typeof_Service, Location){
    return 0;
  }
  return (
    <div className='main-Experience'>
      <div className="top-Experience">

          <h1>Services in {yourLocation} </h1>

          <div className="experience-Category">
            
          { servicesData.category_services.map((service,index) =>(
            <div className="service-item" key={index}>
            <img src={service.photo} alt="" width={"150px"}/>
            <h3>{service.Category_name}</h3>
            <small> <b>{10}</b> Available</small>
          </div>
          ))}
          </div>
       </div>

    </div>
  )
}

export default Experience