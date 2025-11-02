import React from 'react'
import photography from '/static/services Photos/photography.png'
import servicesData from '../data.json'
import '../pages/guest/guest.css'
import SlideshowWheel from './sildeshowWheel'
import Loading from './Loading'
const Experience = ({experienceData,loading}) => {
  const yourLocation = "Manila"; // is important for the number of available services their.
 

  function getNumberAvailable(typeof_Service, Location){
    return 0;
  }
  return (
    <div className='main-Experience'>
      <div className="top-Experience">

          <h1>Services in {yourLocation} </h1>

          <div className="experience-Category">
            
        
          </div>

          <div style={{ padding: "20px" }}>
      {loading ? (
        <Loading message="Loading listings..." />
      ) : experienceData && experienceData.length > 0 ? (
        <SlideshowWheel data={experienceData} useCase={"Experience new things around your area:"} />
      ) : (
        <p style={{ textAlign: "center" }}>No Experience listings found.</p>
      )}
    </div>
       </div>

    </div>
  )
}

export default Experience